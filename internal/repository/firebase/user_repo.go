package firebase

import (
	"context"
	"fmt"
	"strings"

	"firebase.google.com/go/v4/db"

	"github.com/AQADIL/JudGO/internal/domain"
)

type UserRepository interface {
	Create(ctx context.Context, u *domain.User) error
	Get(ctx context.Context, id string) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	Count(ctx context.Context) (int, error)
	List(ctx context.Context) ([]*domain.User, error)
}

type FirebaseUserRepository struct {
	client *db.Client
}

func NewFirebaseUserRepository(client *db.Client) *FirebaseUserRepository {
	return &FirebaseUserRepository{client: client}
}

func (r *FirebaseUserRepository) usersRoot() *db.Ref {
	return r.client.NewRef("users")
}

func (r *FirebaseUserRepository) userRef(id string) *db.Ref {
	return r.usersRoot().Child(id)
}

func (r *FirebaseUserRepository) Create(ctx context.Context, u *domain.User) error {
	if u.ID == "" {
		return fmt.Errorf("user ID is required")
	}
	if u.Email == "" {
		return fmt.Errorf("email is required")
	}

	return r.userRef(u.ID).Set(ctx, u)
}

func (r *FirebaseUserRepository) Get(ctx context.Context, id string) (*domain.User, error) {
	var u domain.User
	if err := r.userRef(id).Get(ctx, &u); err != nil {
		return nil, err
	}
	if u.ID == "" {
		return nil, fmt.Errorf("user %s not found", id)
	}
	return &u, nil
}

func (r *FirebaseUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}

	var users map[string]domain.User
	if err := r.usersRoot().Get(ctx, &users); err != nil {
		return nil, err
	}
	if users == nil {
		return nil, fmt.Errorf("user not found")
	}

	for _, u := range users {
		if strings.ToLower(strings.TrimSpace(u.Email)) == email {
			cp := u
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

func (r *FirebaseUserRepository) Count(ctx context.Context) (int, error) {
	var users map[string]domain.User
	if err := r.usersRoot().Get(ctx, &users); err != nil {
		return 0, err
	}
	if users == nil {
		return 0, nil
	}
	return len(users), nil
}

func (r *FirebaseUserRepository) List(ctx context.Context) ([]*domain.User, error) {
	var users map[string]domain.User
	if err := r.usersRoot().Get(ctx, &users); err != nil {
		return nil, err
	}
	if users == nil {
		return []*domain.User{}, nil
	}

	res := make([]*domain.User, 0, len(users))
	for _, u := range users {
		cp := u
		cp.PasswordHash = ""
		res = append(res, &cp)
	}
	return res, nil
}
