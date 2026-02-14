package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/AQADIL/JudGO/internal/domain"
)

type RoomRepository interface {
	Create(ctx context.Context, r *domain.Room) error
	Get(ctx context.Context, code string) (*domain.Room, error)
	Update(ctx context.Context, r *domain.Room) error
	Delete(ctx context.Context, code string) error
	List(ctx context.Context) ([]*domain.Room, error)
}

type RoomService struct {
	repo RoomRepository
}

var roomRandOnce sync.Once

func NewRoomService(repo RoomRepository) *RoomService {
	return &RoomService{repo: repo}
}

func (s *RoomService) CreateRoom(ctx context.Context, ownerUserID, ownerDisplayName, name string, isPrivate bool, password string, settings domain.RoomSettings) (*domain.Room, error) {
	if ownerUserID == "" {
		return nil, fmt.Errorf("owner user id is required")
	}
	if settings.TaskCount <= 0 {
		return nil, fmt.Errorf("task count is required")
	}
	if settings.MaxPlayers <= 0 {
		settings.MaxPlayers = 4
	}
	if settings.DurationMin < 0 {
		settings.DurationMin = 30
	}
	if settings.Language == "" {
		settings.Language = domain.RoomLanguageGo
	}
	if settings.Difficulty == "" {
		settings.Difficulty = domain.RoomDifficultyEasy
	}
	if len(settings.TaskDifficulties) == 0 {
		settings.TaskDifficulties = make([]domain.RoomDifficulty, settings.TaskCount)
		for i := 0; i < settings.TaskCount; i++ {
			settings.TaskDifficulties[i] = settings.Difficulty
		}
	} else if len(settings.TaskDifficulties) != settings.TaskCount {
		return nil, fmt.Errorf("task difficulties must match task count")
	}

	passwordHash := ""
	if isPrivate {
		password = strings.TrimSpace(password)
		if password == "" {
			return nil, fmt.Errorf("password is required for private room")
		}
		passwordHash = hashPassword(password)
	}

	code, err := s.generateUniqueCode(ctx, 8)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	members := map[string]domain.RoomMember{
		ownerUserID: {
			UserID:      ownerUserID,
			DisplayName: ownerDisplayName,
			JoinedAt:    now,
		},
	}

	room := &domain.Room{
		Code:         code,
		Name:         strings.TrimSpace(name),
		IsPrivate:    isPrivate,
		PasswordHash: passwordHash,
		Status:       domain.RoomStatusWaiting,
		OwnerUserID:  ownerUserID,
		Members:      members,
		Settings:     settings,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.Create(ctx, room); err != nil {
		return nil, err
	}

	cp := *room
	cp.PasswordHash = ""
	return &cp, nil
}

func (s *RoomService) JoinRoom(ctx context.Context, code, userID, displayName, password string) (*domain.Room, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return nil, fmt.Errorf("room code is required")
	}
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}

	room, err := s.repo.Get(ctx, code)
	if err != nil {
		return nil, err
	}
	if room.Status != domain.RoomStatusWaiting {
		return nil, fmt.Errorf("room is not joinable")
	}

	if room.IsPrivate {
		if hashPassword(strings.TrimSpace(password)) != room.PasswordHash {
			return nil, fmt.Errorf("invalid password")
		}
	}

	if room.Members == nil {
		room.Members = map[string]domain.RoomMember{}
	}
	if _, ok := room.Members[userID]; ok {
		cp := *room
		cp.PasswordHash = ""
		return &cp, nil
	}

	maxPlayers := room.Settings.MaxPlayers
	if maxPlayers <= 0 {
		maxPlayers = 4
	}
	if len(room.Members) >= maxPlayers {
		return nil, fmt.Errorf("room is full")
	}

	now := time.Now().UTC()
	room.Members[userID] = domain.RoomMember{UserID: userID, DisplayName: displayName, JoinedAt: now}
	room.UpdatedAt = now

	if err := s.repo.Update(ctx, room); err != nil {
		return nil, err
	}

	cp := *room
	cp.PasswordHash = ""
	return &cp, nil
}

func (s *RoomService) GetRoom(ctx context.Context, code string) (*domain.Room, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	room, err := s.repo.Get(ctx, code)
	if err != nil {
		return nil, err
	}
	cp := *room
	cp.PasswordHash = ""
	return &cp, nil
}

func (s *RoomService) ListRooms(ctx context.Context) ([]*domain.Room, error) {
	rooms, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Room, 0, len(rooms))
	for _, r := range rooms {
		if r != nil {
			r.PasswordHash = ""
			r.Members = nil
		}
		if r == nil {
			continue
		}
		if r.Status != domain.RoomStatusWaiting {
			continue
		}
		out = append(out, r)
	}
	return out, nil
}

func (s *RoomService) StartRoom(ctx context.Context, code, userID, gameID string) (*domain.Room, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return nil, fmt.Errorf("room code is required")
	}
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}
	if gameID == "" {
		return nil, fmt.Errorf("game id is required")
	}

	room, err := s.repo.Get(ctx, code)
	if err != nil {
		return nil, err
	}
	if room.OwnerUserID != userID {
		return nil, fmt.Errorf("only owner can start")
	}
	if room.Status != domain.RoomStatusWaiting {
		return nil, fmt.Errorf("room already started")
	}

	now := time.Now().UTC()
	room.Status = domain.RoomStatusRunning
	room.StartedAt = &now
	room.ActiveGameID = gameID
	room.UpdatedAt = now

	if err := s.repo.Update(ctx, room); err != nil {
		return nil, err
	}
	cp := *room
	cp.PasswordHash = ""
	return &cp, nil
}

func (s *RoomService) LeaveRoom(ctx context.Context, code, userID string) (*domain.Room, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return nil, fmt.Errorf("room code is required")
	}
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}

	room, err := s.repo.Get(ctx, code)
	if err != nil {
		return nil, err
	}
	if room.Members != nil {
		delete(room.Members, userID)
	}
	room.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, room); err != nil {
		return nil, err
	}

	cp := *room
	cp.PasswordHash = ""
	cp.Members = nil
	return &cp, nil
}

func (s *RoomService) DeleteRoom(ctx context.Context, code, userID string) error {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return fmt.Errorf("room code is required")
	}
	if userID == "" {
		return fmt.Errorf("user id is required")
	}

	room, err := s.repo.Get(ctx, code)
	if err != nil {
		return err
	}
	if room.OwnerUserID != userID {
		return fmt.Errorf("only owner can delete")
	}

	return s.repo.Delete(ctx, code)
}

func (s *RoomService) ForceDeleteRoom(ctx context.Context, code string) error {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return fmt.Errorf("room code is required")
	}
	return s.repo.Delete(ctx, code)
}

func RedactRoomForViewer(room *domain.Room, viewerUserID string) *domain.Room {
	if room == nil {
		return nil
	}
	cp := *room
	cp.PasswordHash = ""
	if viewerUserID == "" || cp.Members == nil {
		cp.Members = nil
		return &cp
	}
	if _, ok := cp.Members[viewerUserID]; !ok {
		cp.Members = nil
	}
	return &cp
}

func (s *RoomService) generateUniqueCode(ctx context.Context, n int) (string, error) {
	roomRandOnce.Do(func() {
		rand.Seed(time.Now().UnixNano())
	})

	for i := 0; i < 12; i++ {
		code := randCode(n)
		if _, err := s.repo.Get(ctx, code); err != nil {
			return code, nil
		}
	}
	return "", fmt.Errorf("failed to generate unique room code")
}

func randCode(n int) string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = alphabet[rand.Intn(len(alphabet))]
	}
	return string(b)
}

func hashPassword(pw string) string {
	sum := sha256.Sum256([]byte(pw))
	return hex.EncodeToString(sum[:])
}
