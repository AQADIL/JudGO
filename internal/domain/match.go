package domain

import "time"

type MatchType string

const (
	MatchTypeBot  MatchType = "BOT"
	MatchTypeDuel MatchType = "DUEL"
)

type MatchStatus string

const (
	MatchStatusPending  MatchStatus = "PENDING"
	MatchStatusRunning  MatchStatus = "RUNNING"
	MatchStatusFinished MatchStatus = "FINISHED"
)

// PlayerResult represents a participant's state inside a match.
type PlayerResult struct {
	ID    string `json:"id,omitempty"`
	Name  string `json:"name"`
	Score int    `json:"score"`
}

// Match is the core aggregate stored in Firebase RTDB.
// All fields are JSON-tagged to be compatible with RTDB serialization.
type Match struct {
	ID        string        `json:"id"`
	Type      MatchType     `json:"type"`
	Status    MatchStatus   `json:"status"`
	Player1   PlayerResult  `json:"player1"`
	Player2   *PlayerResult `json:"player2,omitempty"`
	ProblemID string        `json:"problemId,omitempty"`
	Language  string        `json:"language,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
