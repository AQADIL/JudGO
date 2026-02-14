package service

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/AQADIL/JudGO/internal/domain"
)

type ProblemRepository interface {
	Create(ctx context.Context, p *domain.Problem) error
	Get(ctx context.Context, id string) (*domain.Problem, error)
	List(ctx context.Context) ([]*domain.Problem, error)
}

type ProblemService struct {
	repo ProblemRepository
}

func NewProblemService(repo ProblemRepository) *ProblemService {
	return &ProblemService{repo: repo}
}

func trimTrailingWhitespace(s string) string {
	return strings.TrimRightFunc(s, unicode.IsSpace)
}

func normalizeProblem(p *domain.Problem) {
	if p == nil {
		return
	}
	for i := range p.TestCases {
		p.TestCases[i].Input = trimTrailingWhitespace(p.TestCases[i].Input)
		p.TestCases[i].Output = trimTrailingWhitespace(p.TestCases[i].Output)
	}
}

func (s *ProblemService) Create(ctx context.Context, p *domain.Problem) (*domain.Problem, error) {
	if p == nil {
		return nil, fmt.Errorf("problem is required")
	}
	p.ID = strings.TrimSpace(p.ID)
	if p.ID == "" {
		return nil, fmt.Errorf("id is required")
	}
	p.Title = strings.TrimSpace(p.Title)
	if p.Title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if p.Difficulty == "" {
		p.Difficulty = domain.ProblemDifficultyEasy
	}
	if p.Status == "" {
		p.Status = domain.ProblemStatusDraft
	}
	if p.StarterCode == nil {
		p.StarterCode = map[string]string{}
	}
	normalizeProblem(p)

	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	cp := *p
	return &cp, nil
}

func (s *ProblemService) GetAdmin(ctx context.Context, id string) (*domain.Problem, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("id is required")
	}
	return s.repo.Get(ctx, id)
}

func (s *ProblemService) GetPublic(ctx context.Context, id string) (*domain.Problem, error) {
	p, err := s.GetAdmin(ctx, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("problem not found")
	}

	cp := *p
	if len(p.TestCases) > 0 {
		filtered := make([]domain.ProblemTestCase, 0, len(p.TestCases))
		for _, tc := range p.TestCases {
			if tc.IsHidden {
				continue
			}
			filtered = append(filtered, tc)
		}
		cp.TestCases = filtered
	}
	return &cp, nil
}

func (s *ProblemService) ListAdmin(ctx context.Context) ([]*domain.Problem, error) {
	return s.repo.List(ctx)
}
