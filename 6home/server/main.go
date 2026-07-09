package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Server struct {
	mu           sync.Mutex
	rooms        map[string]*Room
	dataDir      string
	turnDuration time.Duration
}

type Client struct {
	ws       *websocket.Conn
	server   *Server
	roomCode string
	token    string
	mu       sync.Mutex
}

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }, ReadBufferSize: 2048, WriteBufferSize: 2048}

func main() {
	dataDir := env("DATA_DIR", "./data")
	_ = os.MkdirAll(dataDir, 0755)
	seconds, _ := strconv.Atoi(env("TURN_SECONDS", "20"))
	s := &Server{rooms: map[string]*Room{}, dataDir: dataDir, turnDuration: time.Duration(seconds) * time.Second}
	s.loadRooms()
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	http.HandleFunc("/ws", s.handleWS)
	port := env("PORT", "8081")
	log.Printf("砸六家服务已启动，端口 %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &Client{ws: ws, server: s}
	c.send(map[string]any{"type": "connected"})
	defer func() { s.disconnect(c); _ = ws.Close() }()
	for {
		var msg inbound
		if err := ws.ReadJSON(&msg); err != nil {
			return
		}
		s.handle(c, msg)
	}
}

func (s *Server) handle(c *Client, msg inbound) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch msg.Type {
	case "create_room":
		s.createRoom(c, msg.Name)
	case "join_room":
		s.joinRoom(c, strings.ToUpper(strings.TrimSpace(msg.RoomCode)), msg.Name, msg.Token)
	case "reconnect":
		s.joinRoom(c, strings.ToUpper(strings.TrimSpace(msg.RoomCode)), "", msg.Token)
	case "sit":
		s.sit(c, msg.Seat)
	case "ready":
		s.ready(c)
	case "start":
		s.start(c)
	case "play":
		s.play(c, msg.Cards)
	case "pass":
		s.pass(c, false)
	case "chat":
		s.chat(c, msg.Msg)
	case "toggle_auto":
		s.toggleAuto(c)
	case "rematch":
		s.rematch(c)
	case "leave_room":
		s.leaveRoom(c)
	case "add_bots":
		s.addBots(c)
	default:
		c.err("不支持的操作")
	}
}

func (s *Server) createRoom(c *Client, name string) {
	name = cleanName(name)
	if name == "" {
		c.err("请输入昵称")
		return
	}
	code := s.uniqueCode()
	token := randomToken()
	r := &Room{Code: code, Players: map[int]*Player{}, Phase: "waiting", Passed: map[int]bool{}, UpdatedAt: time.Now(), Round: 1}
	r.Players[1] = &Player{Token: token, Name: name, Seat: 1, Team: "A", Connected: true, IsHost: true, conn: c}
	s.rooms[code] = r
	c.roomCode = code
	c.token = token
	c.send(map[string]any{"type": "session", "roomCode": code, "token": token, "seat": 1})
	s.persist()
	s.broadcast(r)
}

func (s *Server) joinRoom(c *Client, code, name, token string) {
	r := s.rooms[code]
	if r == nil {
		c.err("房间不存在")
		return
	}
	if token != "" {
		for _, p := range r.Players {
			if p.Token == token {
				p.Connected = true
				p.conn = c
				c.roomCode = code
				c.token = token
				c.send(map[string]any{"type": "session", "roomCode": code, "token": token, "seat": p.Seat})
				s.broadcast(r)
				return
			}
		}
	}
	if r.Phase != "waiting" {
		c.err("游戏已经开始，仅原玩家可以重连")
		return
	}
	name = cleanName(name)
	if name == "" {
		c.err("请输入昵称")
		return
	}
	if len(r.Players) >= 6 {
		c.err("房间已满")
		return
	}
	seat := 0
	for i := 1; i <= 6; i++ {
		if r.Players[i] == nil {
			seat = i
			break
		}
	}
	token = randomToken()
	p := &Player{Token: token, Name: name, Seat: seat, Team: teamFor(seat), Connected: true, conn: c}
	r.Players[seat] = p
	c.roomCode = code
	c.token = token
	c.send(map[string]any{"type": "session", "roomCode": code, "token": token, "seat": seat})
	s.persist()
	s.broadcast(r)
}

func (s *Server) sit(c *Client, seat int) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "waiting" {
		c.err("游戏开始后不能换座")
		return
	}
	if seat < 1 || seat > 6 || r.Players[seat] != nil {
		c.err("这个座位不可用")
		return
	}
	delete(r.Players, p.Seat)
	p.Seat = seat
	p.Team = teamFor(seat)
	r.Players[seat] = p
	s.persist()
	s.broadcast(r)
}

func (s *Server) ready(c *Client) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "waiting" {
		return
	}
	p.Ready = !p.Ready
	s.persist()
	s.broadcast(r)
}

func (s *Server) start(c *Client) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if !p.IsHost {
		c.err("只有房主可以开始")
		return
	}
	if len(r.Players) != 6 {
		c.err("需要6名玩家")
		return
	}
	for _, x := range r.Players {
		if !x.Ready {
			c.err("所有玩家准备后才能开始")
			return
		}
	}
	s.deal(r)
}

func (s *Server) addBots(c *Client) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "waiting" {
		c.err("只能在等候房间添加测试机器人")
		return
	}
	if !p.IsHost {
		c.err("只有房主可以添加测试机器人")
		return
	}
	if len(r.Players) > 1 {
		c.err("测试机器人只能补齐空座位")
		return
	}
	for seat := 1; seat <= 6; seat++ {
		if r.Players[seat] != nil {
			continue
		}
		r.Players[seat] = &Player{Token: "bot-" + randomToken(), Name: fmt.Sprintf("测试机器人%d", seat), Seat: seat, Team: teamFor(seat), Ready: true, Connected: true, Auto: true, Bot: true}
	}
	s.persist()
	s.broadcast(r)
}

func (s *Server) deal(r *Room) {
	deck := newDeck()
	r.Phase = "playing"
	r.LastPlay = nil
	r.DisplayPlay = nil
	r.LastPlayer = 0
	r.Passed = map[int]bool{}
	r.BigGongSeat = 0
	r.FinishCounter = 0
	r.Result = nil
	r.Chats = nil
	r.ActionLog = nil
	for i := 1; i <= 6; i++ {
		p := r.Players[i]
		p.Hand = append([]Card(nil), deck[(i-1)*9:i*9]...)
		sortHand(p.Hand)
		p.Finished = false
		p.Auto = p.Bot
		p.Timeouts = 0
		p.IsBigGong = false
		p.FinishedAt = 0
		for _, card := range p.Hand {
			if card.ID == "H4" {
				r.Current = i
			}
		}
	}
	s.schedule(r)
	s.saveAndBroadcast(r)
}

func (s *Server) play(c *Client, ids []string) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "playing" || r.Current != p.Seat {
		c.err("还没轮到你")
		return
	}
	s.playFor(r, p, ids, false)
}

func (s *Server) playFor(r *Room, p *Player, ids []string, auto bool) {
	play, err := validatePlay(p.Hand, ids, r.LastPlay)
	if err != nil {
		if !auto && p.conn != nil {
			p.conn.err(err.Error())
		}
		return
	}
	play.Seat = p.Seat
	p.Hand = removeCards(p.Hand, ids)
	r.LastPlay = play
	r.DisplayPlay = play
	r.LastPlayer = p.Seat
	r.Passed = map[int]bool{}
	p.Auto = auto || p.Auto
	recordAction(r, ActionLogEntry{Kind: "play", Seat: p.Seat, Cards: play.Cards, At: time.Now()})
	if len(p.Hand) == 0 {
		s.finishPlayer(r, p)
		if r.Phase == "finished" {
			s.saveAndBroadcast(r)
			return
		}
	}
	r.Current = s.nextActive(r, p.Seat)
	r.UpdatedAt = time.Now()
	s.schedule(r)
	s.saveAndBroadcast(r)
}

func (s *Server) pass(c *Client, timeout bool) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "playing" || r.Current != p.Seat {
		if !timeout {
			c.err("还没轮到你")
		}
		return
	}
	if r.LastPlay == nil {
		if !timeout {
			c.err("新一轮必须出牌")
		}
		return
	}
	r.Passed[p.Seat] = true
	recordAction(r, ActionLogEntry{Kind: "pass", Seat: p.Seat, At: time.Now()})
	if timeout {
		p.Timeouts++
		p.Auto = p.Timeouts >= 2
	}
	s.advanceAfterPass(r, p.Seat)
	s.schedule(r)
	s.saveAndBroadcast(r)
}

func (s *Server) advanceAfterPass(r *Room, from int) {
	if s.allOthersDoneOrPassed(r, r.LastPlayer) {
		leader := r.Players[r.LastPlayer]
		r.LastPlay = nil
		r.Passed = map[int]bool{}
		if leader != nil && !leader.Finished {
			r.Current = leader.Seat
		} else {
			r.Current = s.nextActive(r, r.LastPlayer)
		}
		return
	}
	r.Current = s.nextEligible(r, from)
}

func (s *Server) finishPlayer(r *Room, p *Player) {
	r.FinishCounter++
	p.Finished = true
	p.FinishedAt = r.FinishCounter
	if r.BigGongSeat == 0 {
		r.BigGongSeat = p.Seat
		p.IsBigGong = true
	}
	aDone, bDone := true, true
	for _, x := range r.Players {
		if x.Team == "A" && !x.Finished {
			aDone = false
		}
		if x.Team == "B" && !x.Finished {
			bDone = false
		}
	}
	if !aDone && !bDone {
		return
	}
	complete := "A"
	if bDone {
		complete = "B"
	}
	bigTeam := r.Players[r.BigGongSeat].Team
	result := &GameResult{BigGongTeam: bigTeam}
	if complete == bigTeam {
		result.Kind = "win"
		result.WinningTeam = complete
		result.Title = "队伍" + complete + "获胜"
	} else {
		result.Kind = "draw"
		result.Title = "本局平局"
	}
	r.Result = result
	r.Phase = "finished"
	for _, x := range r.Players {
		x.Ready = false
	}
	if r.timer != nil {
		r.timer.Stop()
	}
	s.appendMatch(r)
}

func (s *Server) chat(c *Client, text string) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	text = cleanChatText(text)
	if text == "" {
		c.err("请输入聊天内容")
		return
	}
	r.Chats = append(r.Chats, ChatMessage{Seat: p.Seat, Name: p.Name, Text: text, At: time.Now()})
	if len(r.Chats) > 12 {
		r.Chats = r.Chats[len(r.Chats)-12:]
	}
	s.broadcast(r)
}

func (s *Server) toggleAuto(c *Client) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	p.Auto = !p.Auto
	p.Timeouts = 0
	s.broadcast(r)
	if p.Auto && r.Phase == "playing" && r.Current == p.Seat {
		go func() {
			time.Sleep(500 * time.Millisecond)
			s.mu.Lock()
			defer s.mu.Unlock()
			if r.Phase == "playing" && r.Current == p.Seat {
				s.timeoutTurn(r)
			}
		}()
	}
}

func (s *Server) rematch(c *Client) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "finished" {
		return
	}
	p.Ready = true
	all := true
	for _, x := range r.Players {
		if x.Bot {
			x.Ready = true
		}
		if !x.Connected || !x.Ready {
			all = false
		}
	}
	if all {
		r.Round++
		s.deal(r)
	} else {
		s.broadcast(r)
	}
}

func (s *Server) leaveRoom(c *Client) {
	r, p := s.auth(c)
	if p == nil {
		return
	}
	if r.Phase != "waiting" {
		c.err("对局中请等待重连或开启托管")
		return
	}
	delete(r.Players, p.Seat)
	c.roomCode = ""
	c.token = ""
	if len(r.Players) == 0 {
		delete(s.rooms, r.Code)
	} else if p.IsHost {
		s.transferHost(r, p.Seat)
		s.broadcast(r)
	}
	s.persist()
	c.send(map[string]any{"type": "left"})
}

func (s *Server) schedule(r *Room) {
	if r.timer != nil {
		r.timer.Stop()
	}
	r.TurnDeadline = time.Now().Add(s.turnDuration)
	code := r.Code
	current := r.Current
	r.timer = time.AfterFunc(s.turnDuration, func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		room := s.rooms[code]
		if room != nil && room.Phase == "playing" && room.Current == current {
			s.timeoutTurn(room)
		}
	})
	if p := r.Players[current]; p != nil && p.Bot {
		time.AfterFunc(1800*time.Millisecond, func() {
			s.mu.Lock()
			defer s.mu.Unlock()
			room := s.rooms[code]
			if room != nil && room.Phase == "playing" && room.Current == current {
				s.botMove(room, p)
			}
		})
	}
}

func (s *Server) botMove(r *Room, p *Player) {
	if r.LastPlay == nil && len(p.Hand) > 0 {
		s.playFor(r, p, []string{p.Hand[0].ID}, true)
		return
	}
	s.passInternal(r, p)
}

func (s *Server) timeoutTurn(r *Room) {
	p := r.Players[r.Current]
	if p == nil {
		return
	}
	p.Timeouts++
	if p.Timeouts >= 2 {
		p.Auto = true
	}
	if r.LastPlay != nil {
		s.passInternal(r, p)
		return
	}
	if len(p.Hand) > 0 {
		s.playFor(r, p, []string{p.Hand[0].ID}, true)
	}
}
func (s *Server) passInternal(r *Room, p *Player) {
	r.Passed[p.Seat] = true
	recordAction(r, ActionLogEntry{Kind: "pass", Seat: p.Seat, At: time.Now()})
	s.advanceAfterPass(r, p.Seat)
	s.schedule(r)
	s.saveAndBroadcast(r)
}

func (s *Server) rematchReset(r *Room) {
	for _, p := range r.Players {
		p.Ready = false
	}
	r.Phase = "waiting"
	r.Result = nil
}

func (s *Server) nextActive(r *Room, from int) int {
	for i := 1; i <= 6; i++ {
		seat := (from+i-1)%6 + 1
		if p := r.Players[seat]; p != nil && !p.Finished {
			return seat
		}
	}
	return 0
}
func (s *Server) nextEligible(r *Room, from int) int {
	for i := 1; i <= 6; i++ {
		seat := (from+i-1)%6 + 1
		if p := r.Players[seat]; p != nil && !p.Finished && !r.Passed[seat] {
			return seat
		}
	}
	return r.LastPlayer
}
func (s *Server) allOthersDoneOrPassed(r *Room, leader int) bool {
	for seat, p := range r.Players {
		if seat != leader && !p.Finished && !r.Passed[seat] {
			return false
		}
	}
	return true
}

func (s *Server) auth(c *Client) (*Room, *Player) {
	r := s.rooms[c.roomCode]
	if r == nil {
		c.err("尚未加入房间")
		return nil, nil
	}
	for _, p := range r.Players {
		if p.Token == c.token {
			return r, p
		}
	}
	c.err("玩家身份已失效")
	return nil, nil
}

func (s *Server) disconnect(c *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.rooms[c.roomCode]
	if r == nil {
		return
	}
	for _, p := range r.Players {
		if p.Token == c.token && p.conn == c {
			p.Connected = false
			p.conn = nil
			if p.IsHost {
				s.transferHost(r, p.Seat)
			}
			break
		}
	}
	s.persist()
	s.broadcast(r)
}
func (s *Server) transferHost(r *Room, old int) {
	for i := 1; i <= 6; i++ {
		seat := (old+i-1)%6 + 1
		if p := r.Players[seat]; p != nil && p.Connected {
			for _, x := range r.Players {
				x.IsHost = false
			}
			p.IsHost = true
			return
		}
	}
}

func (s *Server) broadcast(r *Room) {
	for _, p := range r.Players {
		if p.conn != nil {
			s.sendState(r, p)
		}
	}
}
func (s *Server) sendState(r *Room, self *Player) {
	players := make([]publicPlayer, 0, 6)
	for i := 1; i <= 6; i++ {
		if p := r.Players[i]; p != nil {
			players = append(players, publicPlayer{Name: p.Name, Seat: p.Seat, Team: p.Team, Ready: p.Ready, Connected: p.Connected, Finished: p.Finished, Auto: p.Auto, IsHost: p.IsHost, IsBigGong: p.IsBigGong, Bot: p.Bot})
		}
	}
	turnSeconds := 0
	if remaining := time.Until(r.TurnDeadline); remaining > 0 {
		turnSeconds = int((remaining + time.Second - 1) / time.Second)
	}
	self.conn.send(map[string]any{"type": "state", "room": map[string]any{"code": r.Code, "phase": r.Phase, "players": players, "current": r.Current, "lastPlay": r.LastPlay, "displayPlay": r.DisplayPlay, "bigGongSeat": r.BigGongSeat, "round": r.Round, "result": r.Result, "turnDeadline": r.TurnDeadline, "turnSeconds": turnSeconds, "chats": r.Chats, "actionLog": r.ActionLog}, "self": map[string]any{"seat": self.Seat, "team": self.Team, "hand": self.Hand, "ready": self.Ready, "auto": self.Auto, "isHost": self.IsHost}})
}
func (s *Server) saveAndBroadcast(r *Room) { r.UpdatedAt = time.Now(); s.persist(); s.broadcast(r) }

func (c *Client) send(v any)     { c.mu.Lock(); defer c.mu.Unlock(); _ = c.ws.WriteJSON(v) }
func (c *Client) err(msg string) { c.send(map[string]any{"type": "error", "message": msg}) }

func teamFor(seat int) string {
	if seat%2 == 1 {
		return "A"
	}
	return "B"
}
func recordAction(r *Room, entry ActionLogEntry) {
	r.ActionLog = append(r.ActionLog, entry)
	if len(r.ActionLog) > 8 {
		r.ActionLog = r.ActionLog[len(r.ActionLog)-8:]
	}
}
func cleanName(v string) string {
	v = strings.TrimSpace(v)
	r := []rune(v)
	if len(r) > 10 {
		r = r[:10]
	}
	return string(r)
}
func cleanChatText(v string) string {
	v = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(v, "\n", " "), "\r", " "))
	r := []rune(v)
	if len(r) > 40 {
		r = r[:40]
	}
	return strings.TrimSpace(string(r))
}
func randomToken() string { b := make([]byte, 16); _, _ = rand.Read(b); return hex.EncodeToString(b) }
func (s *Server) uniqueCode() string {
	for {
		b := make([]byte, 3)
		_, _ = rand.Read(b)
		n := int(b[0])<<16 | int(b[1])<<8 | int(b[2])
		code := fmt.Sprintf("%06d", n%1000000)
		if s.rooms[code] == nil {
			return code
		}
	}
}

func (s *Server) persist() {
	data, err := json.MarshalIndent(s.rooms, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(s.dataDir, "rooms.json.tmp"), data, 0644)
		_ = os.Rename(filepath.Join(s.dataDir, "rooms.json.tmp"), filepath.Join(s.dataDir, "rooms.json"))
	}
}
func (s *Server) loadRooms() {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "rooms.json"))
	if err != nil {
		return
	}
	if json.Unmarshal(data, &s.rooms) != nil {
		return
	}
	for _, r := range s.rooms {
		r.timer = nil
		for _, p := range r.Players {
			p.Connected = false
			p.conn = nil
		}
		if r.Phase == "playing" {
			r.TurnDeadline = time.Now().Add(s.turnDuration)
		}
	}
}
func (s *Server) appendMatch(r *Room) {
	f, err := os.OpenFile(filepath.Join(s.dataDir, "matches.jsonl"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	record := map[string]any{"room": r.Code, "round": r.Round, "result": r.Result, "finishedAt": time.Now()}
	b, _ := json.Marshal(record)
	_, _ = f.Write(append(b, '\n'))
}
