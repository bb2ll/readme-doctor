package main

import "time"

type Card struct {
	ID   string `json:"id"`
	Suit string `json:"suit"`
	Rank string `json:"rank"`
}

type Player struct {
	Token      string `json:"token"`
	Name       string `json:"name"`
	Seat       int    `json:"seat"`
	Team       string `json:"team"`
	Hand       []Card `json:"hand"`
	Ready      bool   `json:"ready"`
	Connected  bool   `json:"connected"`
	Finished   bool   `json:"finished"`
	Auto       bool   `json:"auto"`
	Timeouts   int    `json:"timeouts"`
	IsHost     bool   `json:"isHost"`
	IsBigGong  bool   `json:"isBigGong"`
	Bot        bool   `json:"bot"`
	FinishedAt int    `json:"finishedAt"`
	conn       *Client
}

type Play struct {
	Seat   int    `json:"seat"`
	Cards  []Card `json:"cards"`
	Target string `json:"target"`
	Count  int    `json:"count"`
	Value  int    `json:"value"`
}

type ChatMessage struct {
	Seat int       `json:"seat"`
	Name string    `json:"name"`
	Text string    `json:"text"`
	At   time.Time `json:"at"`
}

type ActionLogEntry struct {
	Kind  string    `json:"kind"`
	Seat  int       `json:"seat"`
	Cards []Card    `json:"cards,omitempty"`
	At    time.Time `json:"at"`
}

type Room struct {
	Code          string           `json:"code"`
	Players       map[int]*Player  `json:"players"`
	Phase         string           `json:"phase"`
	Current       int              `json:"current"`
	LastPlay      *Play            `json:"lastPlay"`
	DisplayPlay   *Play            `json:"displayPlay"`
	LastPlayer    int              `json:"lastPlayer"`
	Passed        map[int]bool     `json:"passed"`
	BigGongSeat   int              `json:"bigGongSeat"`
	FinishCounter int              `json:"finishCounter"`
	Round         int              `json:"round"`
	Result        *GameResult      `json:"result,omitempty"`
	TurnDeadline  time.Time        `json:"turnDeadline"`
	UpdatedAt     time.Time        `json:"updatedAt"`
	Chats         []ChatMessage    `json:"chats"`
	ActionLog     []ActionLogEntry `json:"actionLog"`
	timer         *time.Timer
}

type GameResult struct {
	Kind        string `json:"kind"`
	WinningTeam string `json:"winningTeam,omitempty"`
	BigGongTeam string `json:"bigGongTeam"`
	Title       string `json:"title"`
}

type inbound struct {
	Type     string   `json:"type"`
	Name     string   `json:"name"`
	RoomCode string   `json:"roomCode"`
	Token    string   `json:"token"`
	Seat     int      `json:"seat"`
	Cards    []string `json:"cards"`
	Msg      string   `json:"msg"`
}

type publicPlayer struct {
	Name      string `json:"name"`
	Seat      int    `json:"seat"`
	Team      string `json:"team"`
	Ready     bool   `json:"ready"`
	Connected bool   `json:"connected"`
	Finished  bool   `json:"finished"`
	Auto      bool   `json:"auto"`
	IsHost    bool   `json:"isHost"`
	IsBigGong bool   `json:"isBigGong"`
	Bot       bool   `json:"bot"`
}
