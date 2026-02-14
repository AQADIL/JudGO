package domain

import "time"

type RoomStatus string

type RoomLanguage string

type RoomDifficulty string

const (
	RoomStatusWaiting RoomStatus = "WAITING"
	RoomStatusRunning RoomStatus = "RUNNING"
	RoomStatusClosed  RoomStatus = "CLOSED"
)

const (
	RoomLanguageGo     RoomLanguage = "GO"
	RoomLanguagePython RoomLanguage = "PY"
)

const (
	RoomDifficultyEasy   RoomDifficulty = "EASY"
	RoomDifficultyMedium RoomDifficulty = "MEDIUM"
	RoomDifficultyHard   RoomDifficulty = "HARD"
)

type RoomMember struct {
	UserID      string    `json:"userId"`
	DisplayName string    `json:"displayName"`
	JoinedAt    time.Time `json:"joinedAt"`
}

type RoomSettings struct {
	Language         RoomLanguage     `json:"language"`
	DurationMin      int              `json:"durationMin"`
	Difficulty       RoomDifficulty   `json:"difficulty"`
	TaskCount        int              `json:"taskCount"`
	TaskDifficulties []RoomDifficulty `json:"taskDifficulties,omitempty"`
	MaxPlayers       int              `json:"maxPlayers"`
	ProblemSetName   string           `json:"problemSetName,omitempty"`
}

type Room struct {
	Code         string                `json:"code"`
	Name         string                `json:"name"`
	IsPrivate    bool                  `json:"isPrivate"`
	PasswordHash string                `json:"passwordHash,omitempty"`
	Status       RoomStatus            `json:"status"`
	OwnerUserID  string                `json:"ownerUserId"`
	Members      map[string]RoomMember `json:"members,omitempty"`
	Settings     RoomSettings          `json:"settings"`
	ActiveGameID string                `json:"activeGameId,omitempty"`
	CreatedAt    time.Time             `json:"createdAt"`
	UpdatedAt    time.Time             `json:"updatedAt"`
	StartedAt    *time.Time            `json:"startedAt,omitempty"`
	ClosedAt     *time.Time            `json:"closedAt,omitempty"`
}
