package main

import "testing"

func c(id, rank string) Card { return Card{ID: id, Rank: rank, Suit: "S"} }
func TestEvaluateNaturalGroup(t *testing.T) {
	p, err := evaluate([]Card{c("S9", "9"), c("H9", "9")})
	if err != nil || p.Target != "9" || p.Count != 2 {
		t.Fatalf("unexpected: %#v %v", p, err)
	}
}
func TestEvaluateWildDown(t *testing.T) {
	p, err := evaluate([]Card{c("JBJ", "BJ"), c("S3", "3"), c("S2", "2")})
	if err != nil || p.Target != "2" {
		t.Fatalf("want triple 2: %#v %v", p, err)
	}
}
func TestThreeMatchesTwoWildcardRange(t *testing.T) {
	p, err := evaluate([]Card{c("S3", "3"), c("SK", "K")})
	if err != nil || p.Target != "K" {
		t.Fatalf("3 should substitute K like 2 does: %#v %v", p, err)
	}
}
func TestWildWithRealTarget(t *testing.T) {
	p, err := evaluate([]Card{c("S3", "3"), c("S2", "2")})
	if err != nil || p.Target != "2" {
		t.Fatalf("3 can substitute a real 2: %#v %v", p, err)
	}
}
func TestPairJoker(t *testing.T) {
	p, err := evaluate([]Card{c("JBJ", "BJ"), c("JSJ", "SJ")})
	if err != nil || p.Target != "PAIR_JOKER" {
		t.Fatalf("unexpected: %#v %v", p, err)
	}
}
func TestCompare(t *testing.T) {
	hand := []Card{c("S9", "9"), c("H9", "9")}
	_, err := validatePlay(hand, []string{"S9", "H9"}, &Play{Count: 2, Value: rankValue["8"]})
	if err != nil {
		t.Fatal(err)
	}
	_, err = validatePlay(hand, []string{"S9", "H9"}, &Play{Count: 2, Value: rankValue["10"]})
	if err == nil {
		t.Fatal("lower play should fail")
	}
}

func TestRoundResetKeepsDisplayPlay(t *testing.T) {
	played := &Play{Seat: 1, Cards: []Card{c("H4", "4")}, Target: "4", Count: 1, Value: rankValue["4"]}
	r := &Room{Players: map[int]*Player{}, LastPlay: played, DisplayPlay: played, LastPlayer: 1, Passed: map[int]bool{2: true, 3: true, 4: true, 5: true, 6: true}}
	for seat := 1; seat <= 6; seat++ {
		r.Players[seat] = &Player{Seat: seat, Team: teamFor(seat)}
	}
	(&Server{}).advanceAfterPass(r, 6)
	if r.LastPlay != nil {
		t.Fatal("round reset must clear the comparison play")
	}
	if r.DisplayPlay != played {
		t.Fatal("round reset must keep the table display play")
	}
	if r.Current != 1 {
		t.Fatalf("leader should start the next round, got %d", r.Current)
	}
}

func TestRoundResetAllowsFreeWildGroup(t *testing.T) {
	played := &Play{Seat: 1, Cards: []Card{c("H4", "4")}, Target: "4", Count: 1, Value: rankValue["4"]}
	r := &Room{Players: map[int]*Player{}, LastPlay: played, DisplayPlay: played, LastPlayer: 1, Passed: map[int]bool{2: true, 3: true, 4: true, 5: true, 6: true}}
	for seat := 1; seat <= 6; seat++ {
		r.Players[seat] = &Player{Seat: seat, Team: teamFor(seat)}
	}
	(&Server{}).advanceAfterPass(r, 6)
	hand := []Card{c("JBJ", "BJ"), c("H9", "9"), c("D9", "9")}
	play, err := validatePlay(hand, []string{"JBJ", "H9", "D9"}, r.LastPlay)
	if err != nil {
		t.Fatalf("new round must allow a free wild triple: %v", err)
	}
	if play.Target != "9" || play.Count != 3 {
		t.Fatalf("want triple 9, got %#v", play)
	}
}

func TestRoundResetAllowsTwoWithPairEight(t *testing.T) {
	played := &Play{Seat: 1, Cards: []Card{c("H4", "4")}, Target: "4", Count: 1, Value: rankValue["4"]}
	r := &Room{Players: map[int]*Player{}, LastPlay: played, DisplayPlay: played, LastPlayer: 1, Passed: map[int]bool{2: true, 3: true, 4: true, 5: true, 6: true}}
	for seat := 1; seat <= 6; seat++ {
		r.Players[seat] = &Player{Seat: seat, Team: teamFor(seat)}
	}
	(&Server{}).advanceAfterPass(r, 6)
	hand := []Card{c("S2", "2"), c("H8", "8"), c("D8", "8")}
	play, err := validatePlay(hand, []string{"S2", "H8", "D8"}, r.LastPlay)
	if err != nil {
		t.Fatalf("new round must allow 2 with a pair of 8: %v", err)
	}
	if play.Target != "8" || play.Count != 3 {
		t.Fatalf("want triple 8, got %#v", play)
	}
}

func TestRoundResetAllowsThreeWithPairEight(t *testing.T) {
	hand := []Card{c("S3", "3"), c("H8", "8"), c("D8", "8")}
	play, err := validatePlay(hand, []string{"S3", "H8", "D8"}, nil)
	if err != nil {
		t.Fatalf("3 should have the same wildcard range as 2: %v", err)
	}
	if play.Target != "8" || play.Count != 3 {
		t.Fatalf("want triple 8, got %#v", play)
	}
}
