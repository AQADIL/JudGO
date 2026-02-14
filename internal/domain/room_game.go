package domain

import "time"

type RoomGameStatus string

const (
	RoomGameStatusRunning  RoomGameStatus = "RUNNING"
	RoomGameStatusFinished RoomGameStatus = "FINISHED"
)

type RoomProblem struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Difficulty   string            `json:"difficulty"`
	Statement    string            `json:"statement"`
	InputFormat  string            `json:"inputFormat"`
	OutputFormat string            `json:"outputFormat"`
	Samples      []ProblemTestCase `json:"samples"`
}

type RoomSubmission struct {
	UserID       string    `json:"userId"`
	DisplayName  string    `json:"displayName"`
	ProblemID    string    `json:"problemId"`
	Code         string    `json:"code"`
	SubmittedAt  time.Time `json:"submittedAt"`
	Correct      bool      `json:"correct"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
}

type RoomUserProgress struct {
	UserID      string                    `json:"userId"`
	DisplayName string                    `json:"displayName"`
	Solved      map[string]bool           `json:"solved,omitempty"`
	LastSubmit  map[string]RoomSubmission `json:"lastSubmit,omitempty"`
}

type RoomGame struct {
	ID           string                      `json:"id"`
	RoomCode     string                      `json:"roomCode"`
	Status       RoomGameStatus              `json:"status"`
	Language     RoomLanguage                `json:"language"`
	DurationMin  int                         `json:"durationMin"`
	StartedAt    time.Time                   `json:"startedAt"`
	EndsAt       time.Time                   `json:"endsAt"`
	FinishedAt   *time.Time                  `json:"finishedAt,omitempty"`
	WinnerUserID string                      `json:"winnerUserId,omitempty"`
	Problems     []RoomProblem               `json:"problems"`
	Progress     map[string]RoomUserProgress `json:"progress,omitempty"`
	MyUserID     string                      `json:"myUserId,omitempty"`
}
