package firebase

import (
    "context"
    "fmt"

    "firebase.google.com/go/v4/db"

    "github.com/AQADIL/JudGO/internal/domain"
)

type MatchRepository interface {
    Create(ctx context.Context, m *domain.Match) error
    Get(ctx context.Context, id string) (*domain.Match, error)
    Update(ctx context.Context, m *domain.Match) error
}


type FirebaseMatchRepository struct {
    client *db.Client
}

func NewFirebaseMatchRepository(client *db.Client) *FirebaseMatchRepository {
    return &FirebaseMatchRepository{client: client}
}

func (r *FirebaseMatchRepository) matchesRoot() *db.Ref {
    return r.client.NewRef("matches")
}

func (r *FirebaseMatchRepository) matchRef(id string) *db.Ref {
    return r.matchesRoot().Child(id)
}

func (r *FirebaseMatchRepository) Create(ctx context.Context, m *domain.Match) error {
    if m.ID == "" {
        return fmt.Errorf("match ID is required")
    }
    return r.matchRef(m.ID).Set(ctx, m)
}

func (r *FirebaseMatchRepository) Get(ctx context.Context, id string) (*domain.Match, error) {
    var m domain.Match
    if err := r.matchRef(id).Get(ctx, &m); err != nil {
        return nil, err
    }
    if m.ID == "" {
        return nil, fmt.Errorf("match %s not found", id)
    }
    return &m, nil
}

func (r *FirebaseMatchRepository) Update(ctx context.Context, m *domain.Match) error {
    if m.ID == "" {
        return fmt.Errorf("match ID is required")
    }
    return r.matchRef(m.ID).Set(ctx, m)
}
