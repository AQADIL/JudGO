package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/AQADIL/JudGO/internal/domain"
)

type RoomGameRepository interface {
	Create(ctx context.Context, g *domain.RoomGame) error
	Get(ctx context.Context, id string) (*domain.RoomGame, error)
	Update(ctx context.Context, g *domain.RoomGame) error
	Delete(ctx context.Context, id string) error
}

type RoomGameService struct {
	repo     RoomGameRepository
	problems *ProblemService
	judge    *JudgeService
}

func NewRoomGameService(repo RoomGameRepository, problems *ProblemService, judge *JudgeService) *RoomGameService {
	return &RoomGameService{repo: repo, problems: problems, judge: judge}
}

func (s *RoomGameService) CreateFromRoom(ctx context.Context, room *domain.Room) (*domain.RoomGame, error) {
	if room == nil {
		return nil, fmt.Errorf("room is required")
	}
	if room.Code == "" {
		return nil, fmt.Errorf("room code is required")
	}

	id := uuid.NewString()
	now := time.Now().UTC()
	durMin := room.Settings.DurationMin
	noTimeLimit := durMin == 0
	if durMin < 0 {
		durMin = 30
	}
	if durMin == 0 && !noTimeLimit {
		durMin = 30
	}
	count := room.Settings.TaskCount
	if count <= 0 {
		count = 1
	}
	if count > 20 {
		count = 20
	}

	problems := make([]domain.RoomProblem, 0, count)
	used := map[string]bool{}

	if s.problems != nil {
		if list, err := s.problems.ListAdmin(ctx); err == nil {
			wantedDiffs := room.Settings.TaskDifficulties
			if len(wantedDiffs) == 0 {
				wantedDiffs = []domain.RoomDifficulty{room.Settings.Difficulty}
			}

			pickOne := func(diff domain.RoomDifficulty) {
				if len(problems) >= count {
					return
				}
				for _, p := range list {
					if p == nil {
						continue
					}
					if p.Status != domain.ProblemStatusPublished {
						continue
					}
					if diff != "" && string(p.Difficulty) != string(diff) {
						continue
					}
					if used[p.ID] {
						continue
					}
					samples := make([]domain.ProblemTestCase, 0)
					if p.TestCases != nil {
						for _, tc := range p.TestCases {
							if tc.IsHidden {
								continue
							}
							samples = append(samples, tc)
							if len(samples) >= 3 {
								break
							}
						}
					}
					problems = append(problems, domain.RoomProblem{
						ID:           p.ID,
						Title:        p.Title,
						Difficulty:   string(p.Difficulty),
						Statement:    p.Statement,
						InputFormat:  p.InputFormat,
						OutputFormat: p.OutputFormat,
						Samples:      samples,
					})
					used[p.ID] = true
					return
				}
			}

			for i := 0; i < count; i++ {
				d := wantedDiffs[i%len(wantedDiffs)]
				pickOne(d)
			}
			for len(problems) < count {
				pickOne("")
				if len(problems) >= count {
					break
				}
				// can't find any new problem
				if len(used) == 0 {
					break
				}
				break
			}
		}
	}

	if len(problems) == 0 {
		problems = append(problems, domain.RoomProblem{ID: "stub-1", Title: "Warmup", Difficulty: string(room.Settings.Difficulty), Statement: "Solve the problem. (Stub task for now)"})
	}

	g := &domain.RoomGame{
		ID:          id,
		RoomCode:    room.Code,
		Status:      domain.RoomGameStatusRunning,
		Language:    room.Settings.Language,
		DurationMin: durMin,
		StartedAt:   now,
		EndsAt:      time.Time{},
		Problems:    problems,
		Progress:    map[string]domain.RoomUserProgress{},
	}
	if !noTimeLimit && durMin > 0 {
		g.EndsAt = now.Add(time.Duration(durMin) * time.Minute)
	}

	if err := s.repo.Create(ctx, g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *RoomGameService) Submit(ctx context.Context, gameID, userID, displayName, problemID, code string) (*domain.RoomGame, *domain.RoomSubmission, error) {
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return nil, nil, fmt.Errorf("game id is required")
	}
	if userID == "" {
		return nil, nil, fmt.Errorf("user id is required")
	}
	problemID = strings.TrimSpace(problemID)
	if problemID == "" {
		return nil, nil, fmt.Errorf("problem id is required")
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, nil, fmt.Errorf("code is required")
	}

	g, err := s.repo.Get(ctx, gameID)
	if err != nil {
		return nil, nil, err
	}
	if g.Status == domain.RoomGameStatusRunning && !g.EndsAt.IsZero() && time.Now().UTC().After(g.EndsAt) {
		now := time.Now().UTC()
		g.Status = domain.RoomGameStatusFinished
		g.FinishedAt = &now
		g.WinnerUserID = s.winnerByMostSolved(g)
		_ = s.repo.Update(ctx, g)
		return g, nil, nil
	}
	if g.Status == domain.RoomGameStatusFinished {
		return g, nil, nil
	}

	found := false
	for _, p := range g.Problems {
		if p.ID == problemID {
			found = true
			break
		}
	}
	if !found {
		return nil, nil, fmt.Errorf("problem not in this room")
	}

	if g.Progress == nil {
		g.Progress = map[string]domain.RoomUserProgress{}
	}
	pr := g.Progress[userID]
	if pr.UserID == "" {
		pr = domain.RoomUserProgress{UserID: userID, DisplayName: displayName, Solved: map[string]bool{}, LastSubmit: map[string]domain.RoomSubmission{}}
	}
	if pr.Solved == nil {
		pr.Solved = map[string]bool{}
	}
	if pr.LastSubmit == nil {
		pr.LastSubmit = map[string]domain.RoomSubmission{}
	}

	sub := domain.RoomSubmission{
		UserID:      userID,
		DisplayName: displayName,
		ProblemID:   problemID,
		Code:        code,
		SubmittedAt: time.Now().UTC(),
		Correct:     false,
	}

	if s.judge != nil && problemID != "" {
		lang := JudgeLanguage(strings.ToLower(string(g.Language)))
		jr, jerr := s.judge.Judge(ctx, problemID, lang, code, 5*time.Second)
		if jerr != nil {
			sub.Correct = false
			sub.ErrorMessage = jerr.Error()
		} else {
			if jr != nil {
				sub.Correct = jr.Passed
				if !jr.Passed {
					sub.ErrorMessage = fmt.Sprintf("wrong answer: %d/%d", jr.PassedCnt, jr.TotalCnt)
				}
			}
		}
	} else {
		sub.Correct = strings.EqualFold(code, "CORRECT")
	}

	pr.LastSubmit[problemID] = sub
	if sub.Correct {
		pr.Solved[problemID] = true
	}
	g.Progress[userID] = pr

	if s.userSolvedAll(g, userID) {
		g.Status = domain.RoomGameStatusFinished
		now := time.Now().UTC()
		g.FinishedAt = &now
		g.WinnerUserID = userID
	}

	if err := s.repo.Update(ctx, g); err != nil {
		return nil, nil, err
	}

	cp := sub
	return g, &cp, nil
}

func (s *RoomGameService) userSolvedAll(g *domain.RoomGame, userID string) bool {
	if g == nil {
		return false
	}
	pr, ok := g.Progress[userID]
	if !ok {
		return false
	}
	for _, p := range g.Problems {
		if p.ID == "" {
			continue
		}
		if !pr.Solved[p.ID] {
			return false
		}
	}
	return true
}

func (s *RoomGameService) winnerByMostSolved(g *domain.RoomGame) string {
	if g == nil {
		return ""
	}
	bestID := ""
	bestCnt := -1
	for uid, pr := range g.Progress {
		cnt := 0
		for _, p := range g.Problems {
			if p.ID != "" && pr.Solved != nil && pr.Solved[p.ID] {
				cnt++
			}
		}
		if cnt > bestCnt {
			bestCnt = cnt
			bestID = uid
		}
	}
	if bestCnt <= 0 {
		return ""
	}
	return bestID
}

func (s *RoomGameService) Get(ctx context.Context, gameID string) (*domain.RoomGame, error) {
	g, err := s.repo.Get(ctx, gameID)
	if err != nil {
		return nil, err
	}
	if g.Status == domain.RoomGameStatusRunning && !g.EndsAt.IsZero() && time.Now().UTC().After(g.EndsAt) {
		now := time.Now().UTC()
		g.Status = domain.RoomGameStatusFinished
		g.FinishedAt = &now
		g.WinnerUserID = s.winnerByMostSolved(g)
		_ = s.repo.Update(ctx, g)
	}
	return g, nil
}

func (s *RoomGameService) Delete(ctx context.Context, gameID string) error {
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return fmt.Errorf("game id is required")
	}
	return s.repo.Delete(ctx, gameID)
}
