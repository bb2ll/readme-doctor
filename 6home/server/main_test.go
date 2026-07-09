package main

import (
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
