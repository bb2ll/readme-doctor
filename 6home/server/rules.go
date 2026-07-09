package main

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
)

var rankValue = map[string]int{
	"4": 1, "5": 2, "6": 3, "7": 4, "8": 5, "9": 6,
	"10": 7, "J": 8, "Q": 9, "K": 10, "A": 11, "2": 12,
	"3": 13, "SJ": 14, "BJ": 15, "PAIR_JOKER": 16,
}

var suits = []string{"S", "H", "C", "D"}
var ranks = []string{"4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "3"}

func newDeck() []Card {
	deck := make([]Card, 0, 54)
	for _, s := range suits {
		for _, r := range ranks {
			deck = append(deck, Card{ID: s + r, Suit: s, Rank: r})
		}
	}
	deck = append(deck, Card{ID: "JSJ", Suit: "J", Rank: "SJ"}, Card{ID: "JBJ", Suit: "J", Rank: "BJ"})
	rand.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })
	return deck
}

func sortHand(hand []Card) {
	sort.Slice(hand, func(i, j int) bool {
		if rankValue[hand[i].Rank] == rankValue[hand[j].Rank] {
			return hand[i].Suit < hand[j].Suit
		}
		return rankValue[hand[i].Rank] < rankValue[hand[j].Rank]
	})
}

func isWild(rank string) bool { return rank == "BJ" || rank == "SJ" || rank == "3" || rank == "2" }

func canSubstitute(wild, target string) bool {
	if wild == "BJ" {
		return rankValue[target] < rankValue["BJ"]
	}
	if wild == "SJ" {
		return rankValue[target] <= rankValue["3"]
	}
	if wild == "3" {
		return target == "2"
	}
	if wild == "2" {
		return target == "A"
	}
	return false
}

func evaluate(cards []Card) (*Play, error) {
	if len(cards) < 1 || len(cards) > 9 {
		return nil, errors.New("每次只能出1到9张牌")
	}
	if len(cards) == 2 && ((cards[0].Rank == "BJ" && cards[1].Rank == "SJ") || (cards[0].Rank == "SJ" && cards[1].Rank == "BJ")) {
		return &Play{Cards: cards, Target: "PAIR_JOKER", Count: 2, Value: rankValue["PAIR_JOKER"]}, nil
	}
	if len(cards) == 1 {
		return &Play{Cards: cards, Target: cards[0].Rank, Count: 1, Value: rankValue[cards[0].Rank]}, nil
	}

	targets := map[string]bool{}
	for _, c := range cards {
		targets[c.Rank] = true
	}
	valid := make([]string, 0)
	for target := range targets {
		ok := true
		for _, c := range cards {
			if c.Rank == target {
				continue
			}
			if !isWild(c.Rank) || !canSubstitute(c.Rank, target) {
				ok = false
				break
			}
		}
		if ok {
			valid = append(valid, target)
		}
	}
	if len(valid) == 0 {
		return nil, errors.New("这些牌不能组成同一点数")
	}
	sort.Slice(valid, func(i, j int) bool { return rankValue[valid[i]] > rankValue[valid[j]] })
	target := valid[0]
	return &Play{Cards: cards, Target: target, Count: len(cards), Value: rankValue[target]}, nil
}

func validatePlay(hand []Card, ids []string, last *Play) (*Play, error) {
	if len(ids) == 0 {
		return nil, errors.New("请先选择要出的牌")
	}
	available := make(map[string]Card, len(hand))
	for _, c := range hand {
		available[c.ID] = c
	}
	seen := map[string]bool{}
	selected := make([]Card, 0, len(ids))
	for _, id := range ids {
		if seen[id] {
			return nil, errors.New("不能重复选择同一张牌")
		}
		card, ok := available[id]
		if !ok {
			return nil, errors.New("选择的牌不在手中")
		}
		seen[id] = true
		selected = append(selected, card)
	}
	play, err := evaluate(selected)
	if err != nil {
		return nil, err
	}
	if last != nil {
		if play.Count != last.Count {
			return nil, fmt.Errorf("需要出%d张牌", last.Count)
		}
		if play.Value <= last.Value {
			return nil, errors.New("所出的牌没有压过上一手")
		}
	}
	return play, nil
}

func removeCards(hand []Card, ids []string) []Card {
	remove := map[string]bool{}
	for _, id := range ids {
		remove[id] = true
	}
	out := hand[:0]
	for _, c := range hand {
		if !remove[c.ID] {
			out = append(out, c)
		}
	}
	return out
}
