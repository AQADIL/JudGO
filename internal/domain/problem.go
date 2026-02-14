package domain

import "time"

type ProblemDifficulty string

const (
	ProblemDifficultyEasy   ProblemDifficulty = "EASY"
	ProblemDifficultyMedium ProblemDifficulty = "MEDIUM"
	ProblemDifficultyHard   ProblemDifficulty = "HARD"
)

type ProblemStatus string

const (
	ProblemStatusDraft     ProblemStatus = "DRAFT"
	ProblemStatusPublished ProblemStatus = "PUBLISHED"
	ProblemStatusArchived  ProblemStatus = "ARCHIVED"
)

type ProblemTestCase struct {
	Input    string `json:"input"`
	Output   string `json:"output"`
	IsHidden bool   `json:"isHidden"`
}

type Problem struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Statement    string            `json:"statement"`
	InputFormat  string            `json:"inputFormat"`
	OutputFormat string            `json:"outputFormat"`
	Difficulty   ProblemDifficulty `json:"difficulty"`
	Tags         []string          `json:"tags"`
	Status       ProblemStatus     `json:"status"`

	StarterCode map[string]string `json:"starterCode"`
	TestCases   []ProblemTestCase `json:"testCases"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
