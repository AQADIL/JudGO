package firebase

import (
	"context"
	"fmt"

	"firebase.google.com/go/v4/db"

	"github.com/AQADIL/JudGO/internal/domain"
)

type ProblemRepository interface {
	Create(ctx context.Context, p *domain.Problem) error
	Get(ctx context.Context, id string) (*domain.Problem, error)
	List(ctx context.Context) ([]*domain.Problem, error)
}

type FirebaseProblemRepository struct {
	client *db.Client
}

func NewFirebaseProblemRepository(client *db.Client) *FirebaseProblemRepository {
	return &FirebaseProblemRepository{client: client}
}

func (r *FirebaseProblemRepository) problemsRoot() *db.Ref {
	return r.client.NewRef("problems")
}

func (r *FirebaseProblemRepository) problemRef(id string) *db.Ref {
	return r.problemsRoot().Child(id)
}

func (r *FirebaseProblemRepository) Create(ctx context.Context, p *domain.Problem) error {
	if p == nil {
		return fmt.Errorf("problem is required")
	}
	if p.ID == "" {
		return fmt.Errorf("problem id is required")
	}
	return r.problemRef(p.ID).Set(ctx, p)
}

func (r *FirebaseProblemRepository) Get(ctx context.Context, id string) (*domain.Problem, error) {
	var p domain.Problem
	if err := r.problemRef(id).Get(ctx, &p); err != nil {
		return nil, err
	}
	if p.ID == "" {
		return nil, fmt.Errorf("problem %s not found", id)
	}
	return &p, nil
}

func (r *FirebaseProblemRepository) List(ctx context.Context) ([]*domain.Problem, error) {
	var items map[string]domain.Problem
	if err := r.problemsRoot().Get(ctx, &items); err != nil {
		return nil, err
	}
	if items == nil {
		return []*domain.Problem{}, nil
	}
	res := make([]*domain.Problem, 0, len(items))
	for _, v := range items {
		cp := v
		res = append(res, &cp)
	}
	return res, nil
}
