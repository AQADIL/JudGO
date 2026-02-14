package firebase

import (
	"context"
	"fmt"
	"strings"

	"firebase.google.com/go/v4/db"

	"github.com/AQADIL/JudGO/internal/domain"
)

type RoomGameRepository interface {
	Create(ctx context.Context, g *domain.RoomGame) error
	Get(ctx context.Context, id string) (*domain.RoomGame, error)
	Update(ctx context.Context, g *domain.RoomGame) error
	Delete(ctx context.Context, id string) error
}

type FirebaseRoomGameRepository struct {
	client *db.Client
}

func NewFirebaseRoomGameRepository(client *db.Client) *FirebaseRoomGameRepository {
	return &FirebaseRoomGameRepository{client: client}
}

func (r *FirebaseRoomGameRepository) gamesRoot() *db.Ref {
	return r.client.NewRef("roomGames")
}

func (r *FirebaseRoomGameRepository) gameRef(id string) *db.Ref {
	return r.gamesRoot().Child(id)
}

func (r *FirebaseRoomGameRepository) Create(ctx context.Context, g *domain.RoomGame) error {
	if g.ID == "" {
		return fmt.Errorf("game id is required")
	}
	return r.gameRef(g.ID).Set(ctx, g)
}

func (r *FirebaseRoomGameRepository) Get(ctx context.Context, id string) (*domain.RoomGame, error) {
	var g domain.RoomGame
	if err := r.gameRef(id).Get(ctx, &g); err != nil {
		return nil, err
	}
	if g.ID == "" {
		return nil, fmt.Errorf("game %s not found", id)
	}
	return &g, nil
}

func (r *FirebaseRoomGameRepository) Update(ctx context.Context, g *domain.RoomGame) error {
	if g.ID == "" {
		return fmt.Errorf("game id is required")
	}
	return r.gameRef(g.ID).Set(ctx, g)
}

func (r *FirebaseRoomGameRepository) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("game id is required")
	}
	return r.gameRef(id).Delete(ctx)
}
