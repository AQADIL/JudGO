package firebase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"firebase.google.com/go/v4/db"
)

type PracticeSubmission struct {
	UserID        string    `json:"userId"`
	ProblemID     string    `json:"problemId"`
	Language      string    `json:"language"`
	Code          string    `json:"code"`
	AttemptNumber int       `json:"attemptNumber"`
	Passed        bool      `json:"passed"`
	PassedCount   int       `json:"passedCount"`
	TotalCount    int       `json:"totalCount"`
	CreatedAt     time.Time `json:"createdAt"`
}

type PracticeSolved struct {
	UserID          string    `json:"userId"`
	ProblemID       string    `json:"problemId"`
	AttemptsToSolve int       `json:"attemptsToSolve"`
	SolvedAt        time.Time `json:"solvedAt"`
}

type PracticeRepository interface {
	Create(ctx context.Context, s *PracticeSubmission) error
	NextAttemptNumber(ctx context.Context, userID, problemID string) (int, error)
	MarkSolvedIfFirst(ctx context.Context, userID, problemID string, attemptsToSolve int) error
	ListSolved(ctx context.Context, userID string) (map[string]PracticeSolved, error)
	ListSubmissions(ctx context.Context, userID string) ([]PracticeSubmission, error)
}

type FirebasePracticeRepository struct {
	client *db.Client
}

func NewFirebasePracticeRepository(client *db.Client) *FirebasePracticeRepository {
	return &FirebasePracticeRepository{client: client}
}

func (r *FirebasePracticeRepository) countersRoot() *db.Ref {
	return r.client.NewRef("practiceAttemptCounters")
}

func (r *FirebasePracticeRepository) counterRef(userID, problemID string) *db.Ref {
	return r.countersRoot().Child(userID).Child(problemID)
}

func (r *FirebasePracticeRepository) submissionsRoot() *db.Ref {
	return r.client.NewRef("practiceSubmissions")
}

func (r *FirebasePracticeRepository) solvedRoot() *db.Ref {
	return r.client.NewRef("practiceSolved")
}

func (r *FirebasePracticeRepository) solvedRef(userID, problemID string) *db.Ref {
	return r.solvedRoot().Child(userID).Child(problemID)
}

func (r *FirebasePracticeRepository) submissionRef(userID, problemID, id string) *db.Ref {
	return r.submissionsRoot().Child(userID).Child(problemID).Child(id)
}

func (r *FirebasePracticeRepository) NextAttemptNumber(ctx context.Context, userID, problemID string) (int, error) {
	userID = strings.TrimSpace(userID)
	problemID = strings.TrimSpace(problemID)
	if userID == "" {
		return 0, fmt.Errorf("userID is required")
	}
	if problemID == "" {
		return 0, fmt.Errorf("problemID is required")
	}

	var cur int
	if err := r.counterRef(userID, problemID).Get(ctx, &cur); err != nil {
		return 0, err
	}
	next := cur + 1
	if err := r.counterRef(userID, problemID).Set(ctx, next); err != nil {
		return 0, err
	}
	return next, nil
}

func (r *FirebasePracticeRepository) Create(ctx context.Context, s *PracticeSubmission) error {
	if s == nil {
		return fmt.Errorf("submission is required")
	}
	s.UserID = strings.TrimSpace(s.UserID)
	s.ProblemID = strings.TrimSpace(s.ProblemID)
	s.Language = strings.TrimSpace(s.Language)
	if s.UserID == "" {
		return fmt.Errorf("userId is required")
	}
	if s.ProblemID == "" {
		return fmt.Errorf("problemId is required")
	}
	if s.AttemptNumber <= 0 {
		return fmt.Errorf("attemptNumber is required")
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now().UTC()
	}

	id := fmt.Sprintf("%d", time.Now().UTC().UnixNano())
	return r.submissionRef(s.UserID, s.ProblemID, id).Set(ctx, s)
}

func (r *FirebasePracticeRepository) MarkSolvedIfFirst(ctx context.Context, userID, problemID string, attemptsToSolve int) error {
	userID = strings.TrimSpace(userID)
	problemID = strings.TrimSpace(problemID)
	if userID == "" {
		return fmt.Errorf("userID is required")
	}
	if problemID == "" {
		return fmt.Errorf("problemID is required")
	}
	if attemptsToSolve <= 0 {
		return fmt.Errorf("attemptsToSolve must be > 0")
	}

	var existing PracticeSolved
	if err := r.solvedRef(userID, problemID).Get(ctx, &existing); err != nil {
		return err
	}
	if !existing.SolvedAt.IsZero() || existing.AttemptsToSolve > 0 {
		return nil
	}

	rec := &PracticeSolved{
		UserID:          userID,
		ProblemID:       problemID,
		AttemptsToSolve: attemptsToSolve,
		SolvedAt:        time.Now().UTC(),
	}
	return r.solvedRef(userID, problemID).Set(ctx, rec)
}

func (r *FirebasePracticeRepository) ListSolved(ctx context.Context, userID string) (map[string]PracticeSolved, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, fmt.Errorf("userID is required")
	}
	var items map[string]PracticeSolved
	if err := r.solvedRoot().Child(userID).Get(ctx, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return map[string]PracticeSolved{}, nil
	}
	return items, nil
}

func (r *FirebasePracticeRepository) ListSubmissions(ctx context.Context, userID string) ([]PracticeSubmission, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, fmt.Errorf("userID is required")
	}
	var raw interface{}
	if err := r.submissionsRoot().Child(userID).Get(ctx, &raw); err != nil {
		return nil, err
	}
	if raw == nil {
		return []PracticeSubmission{}, nil
	}
	toInt := func(v interface{}) int {
		switch n := v.(type) {
		case int:
			return n
		case int64:
			return int(n)
		case float64:
			return int(n)
		case json.Number:
			i, _ := n.Int64()
			return int(i)
		default:
			return 0
		}
	}
	toStr := func(v interface{}) string {
		s, _ := v.(string)
		return strings.TrimSpace(s)
	}
	toBool := func(v interface{}) bool {
		b, _ := v.(bool)
		return b
	}
	toTime := func(v interface{}) time.Time {
		s, ok := v.(string)
		if !ok {
			return time.Time{}
		}
		t, err := time.Parse(time.RFC3339Nano, s)
		if err == nil {
			return t
		}
		t, _ = time.Parse(time.RFC3339, s)
		return t
	}

	res := make([]PracticeSubmission, 0)
	var walk func(node interface{})
	walk = func(node interface{}) {
		m, ok := node.(map[string]interface{})
		if !ok {
			return
		}
		if _, hasUser := m["userId"]; hasUser {
			if _, hasProb := m["problemId"]; hasProb {
				s := PracticeSubmission{
					UserID:        toStr(m["userId"]),
					ProblemID:     toStr(m["problemId"]),
					Language:      toStr(m["language"]),
					Code:          toStr(m["code"]),
					AttemptNumber: toInt(m["attemptNumber"]),
					Passed:        toBool(m["passed"]),
					PassedCount:   toInt(m["passedCount"]),
					TotalCount:    toInt(m["totalCount"]),
					CreatedAt:     toTime(m["createdAt"]),
				}
				res = append(res, s)
				return
			}
		}
		for _, v := range m {
			walk(v)
		}
	}
	walk(raw)
	return res, nil
}
