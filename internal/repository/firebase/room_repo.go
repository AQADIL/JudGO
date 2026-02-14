package firebase

import (
	"context"
	"fmt"

	"firebase.google.com/go/v4/db"

	"github.com/AQADIL/JudGO/internal/domain"
)

type RoomRepository interface {
	Create(ctx context.Context, r *domain.Room) error
	Get(ctx context.Context, code string) (*domain.Room, error)
	Update(ctx context.Context, r *domain.Room) error
	Delete(ctx context.Context, code string) error
	List(ctx context.Context) ([]*domain.Room, error)
}

type FirebaseRoomRepository struct {
	client *db.Client
}

func NewFirebaseRoomRepository(client *db.Client) *FirebaseRoomRepository {
	return &FirebaseRoomRepository{client: client}
}

func (r *FirebaseRoomRepository) roomsRoot() *db.Ref {
	return r.client.NewRef("rooms")
}

func (r *FirebaseRoomRepository) roomRef(code string) *db.Ref {
	return r.roomsRoot().Child(code)
}

func (r *FirebaseRoomRepository) Create(ctx context.Context, room *domain.Room) error {
	if room.Code == "" {
		return fmt.Errorf("room code is required")
	}
	return r.roomRef(room.Code).Set(ctx, room)
}

func (r *FirebaseRoomRepository) Get(ctx context.Context, code string) (*domain.Room, error) {
	var room domain.Room
	if err := r.roomRef(code).Get(ctx, &room); err != nil {
		return nil, err
	}
	if room.Code == "" {
		return nil, fmt.Errorf("room %s not found", code)
	}
	return &room, nil
}

func (r *FirebaseRoomRepository) Update(ctx context.Context, room *domain.Room) error {
	if room.Code == "" {
		return fmt.Errorf("room code is required")
	}
	return r.roomRef(room.Code).Set(ctx, room)
}

func (r *FirebaseRoomRepository) Delete(ctx context.Context, code string) error {
	if code == "" {
		return fmt.Errorf("room code is required")
	}
	return r.roomRef(code).Delete(ctx)
}

func (r *FirebaseRoomRepository) List(ctx context.Context) ([]*domain.Room, error) {
	var rooms map[string]domain.Room
	if err := r.roomsRoot().Get(ctx, &rooms); err != nil {
		return nil, err
	}
	if rooms == nil {
		return []*domain.Room{}, nil
	}

	res := make([]*domain.Room, 0, len(rooms))
	for _, v := range rooms {
		cp := v
		res = append(res, &cp)
	}
	return res, nil
}
