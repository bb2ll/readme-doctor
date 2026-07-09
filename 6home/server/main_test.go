package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRematchResetClearsFinishedRoundState(t *testing.T) {
	server := &Server{}
	result := &GameResult{Kind: "win", WinningTeam: "A"}
	room := &Room{
		Phase:         "finished",
		Current:       4,
		LastPlay:      &Play{Seat: 4},
		DisplayPlay:   &Play{Seat: 4},
		LastPlayer:    4,
		Passed:        map[int]bool{2: true},
		BigGongSeat:   1,
		FinishCounter: 4,
		Result:        result,
		TurnDeadline:  time.Now(),
		ActionLog:     []ActionLogEntry{{Kind: "play", Seat: 4}},
		Players: map[int]*Player{
			1: {Seat: 1, Hand: []Card{{ID: "H4"}}, Ready: true, Finished: true, Auto: true, Timeouts: 2, IsBigGong: true, FinishedAt: 1},
			2: {Seat: 2, Bot: true, Hand: []Card{{ID: "S4"}}, Ready: true, Finished: true, Auto: true, Timeouts: 2, FinishedAt: 2},
		},
	}

	server.rematchReset(room)

	if room.Phase != "waiting" || room.Result != nil || room.Current != 0 {
		t.Fatalf("room was not reset to waiting state: %+v", room)
	}
	if room.LastPlay != nil || room.DisplayPlay != nil || room.LastPlayer != 0 || room.BigGongSeat != 0 || room.FinishCounter != 0 {
		t.Fatal("round play state was not cleared")
	}
	if len(room.Passed) != 0 || len(room.ActionLog) != 0 || !room.TurnDeadline.IsZero() {
		t.Fatal("round history or deadline was not cleared")
	}
	human := room.Players[1]
	if len(human.Hand) != 0 || human.Ready || human.Finished || human.Auto || human.Timeouts != 0 || human.IsBigGong || human.FinishedAt != 0 {
		t.Fatalf("human state was not cleared: %+v", human)
	}
	bot := room.Players[2]
	if len(bot.Hand) != 0 || !bot.Ready || bot.Finished || !bot.Auto || bot.Timeouts != 0 || bot.FinishedAt != 0 {
		t.Fatalf("bot waiting state is invalid: %+v", bot)
	}
}

func TestTransferHostSkipsBots(t *testing.T) {
	server := &Server{}
	room := &Room{Players: map[int]*Player{
		1: {Seat: 1, Connected: true, IsHost: true},
		2: {Seat: 2, Connected: true, Bot: true},
		3: {Seat: 3, Connected: true},
	}}

	server.transferHost(room, 1)

	if room.Players[1].IsHost || room.Players[2].IsHost || !room.Players[3].IsHost {
		t.Fatal("host was not transferred to the next connected human")
	}
}

func TestAssignHostIfMissing(t *testing.T) {
	server := &Server{}
	bot := &Player{Seat: 2, Connected: true, Bot: true, IsHost: true}
	human := &Player{Seat: 3, Connected: true}
	room := &Room{Players: map[int]*Player{2: bot, 3: human}}

	server.assignHostIfMissing(room, human)
	if bot.IsHost || !human.IsHost {
		t.Fatal("connected human should replace an invalid bot host")
	}

	disconnectedHost := &Player{Seat: 1, IsHost: true}
	reconnectedHuman := &Player{Seat: 4, Connected: true}
	room = &Room{Players: map[int]*Player{1: disconnectedHost, 4: reconnectedHuman}}
	server.assignHostIfMissing(room, reconnectedHuman)
	if disconnectedHost.IsHost || !reconnectedHuman.IsHost {
		t.Fatal("disconnected host should not block a connected human from taking over")
	}
}

func TestLoadRoomsRestoresBotsAndPlayingTimer(t *testing.T) {
	dataDir := t.TempDir()
	room := &Room{
		Code:    "123456",
		Phase:   "playing",
		Current: 1,
		Players: map[int]*Player{
			1: {Seat: 1, Connected: true},
			2: {Seat: 2, Connected: false, Bot: true},
		},
	}
	data, err := json.Marshal(map[string]*Room{room.Code: room})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "rooms.json"), data, 0644); err != nil {
		t.Fatal(err)
	}

	server := &Server{rooms: map[string]*Room{}, dataDir: dataDir, turnDuration: time.Minute}
	server.loadRooms()
	loaded := server.rooms[room.Code]
	if loaded == nil {
		t.Fatal("room was not restored")
	}
	defer loaded.timer.Stop()

	if loaded.Players[1].Connected {
		t.Fatal("human players must require reconnect after restart")
	}
	if !loaded.Players[2].Connected {
		t.Fatal("bots should remain available after restart")
	}
	if loaded.timer == nil || loaded.TurnDeadline.Before(time.Now()) {
		t.Fatal("playing room timer was not restored")
	}
}

func TestSameOrigin(t *testing.T) {
	request := httptest.NewRequest("GET", "http://game.example/ws", nil)
	request.Host = "game.example"
	if !sameOrigin(request) {
		t.Fatal("requests without an Origin header should be allowed")
	}

	request.Header.Set("Origin", "https://game.example")
	if !sameOrigin(request) {
		t.Fatal("matching browser origin should be allowed")
	}

	request.Host = "game.example:4288"
	request.Header.Set("Origin", "http://game.example:4288")
	if !sameOrigin(request) {
		t.Fatal("matching local origin with port should be allowed")
	}

	request.Host = "game.example"
	request.Header.Set("Origin", "https://evil.example")
	if sameOrigin(request) {
		t.Fatal("cross-origin websocket request should be rejected")
	}

	request.Header.Set("Origin", "not a valid origin")
	if sameOrigin(request) {
		t.Fatal("malformed origin should be rejected")
	}
}
