package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/AQADIL/JudGO/internal/domain"
)

type UserRepository interface {
	Create(ctx context.Context, u *domain.User) error
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	Count(ctx context.Context) (int, error)
}

type AuthService struct {
	repo       UserRepository
	jwtSecret  []byte
	tokenTTL   time.Duration
	issuerName string
}

func NewAuthService(repo UserRepository) *AuthService {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-me"
	}

	issuer := os.Getenv("JWT_ISSUER")
	if issuer == "" {
		issuer = "judgo"
	}

	return &AuthService{
		repo:       repo,
		jwtSecret:  []byte(secret),
		tokenTTL:   24 * time.Hour,
		issuerName: issuer,
	}
}

type AuthResult struct {
	Token string       `json:"token"`
	User  *domain.User `json:"user"`
}

func (s *AuthService) Signup(ctx context.Context, email, password, displayName string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return nil, fmt.Errorf("email and password are required")
	}
	if displayName == "" {
		displayName = strings.Split(email, "@")[0]
	}

	// If user exists, fail.
	if _, err := s.repo.GetByEmail(ctx, email); err == nil {
		return nil, fmt.Errorf("user already exists")
	}

	count, err := s.repo.Count(ctx)
	if err != nil {
		return nil, err
	}
	role := domain.UserRoleUser
	if count == 0 {
		role = domain.UserRoleAdmin
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	u := &domain.User{
		ID:           uuid.NewString(),
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: string(hash),
		Role:         role,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}

	tok, err := s.issueToken(u)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: tok, User: s.sanitizeUser(u)}, nil
}

func (s *AuthService) Signin(ctx context.Context, email, password string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return nil, fmt.Errorf("email and password are required")
	}

	u, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	tok, err := s.issueToken(u)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: tok, User: s.sanitizeUser(u)}, nil
}

func (s *AuthService) issueToken(u *domain.User) (string, error) {
	now := time.Now().UTC()
	claims := jwt.MapClaims{
		"sub":   u.ID,
		"email": u.Email,
		"role":  string(u.Role),
		"iss":   s.issuerName,
		"iat":   now.Unix(),
		"exp":   now.Add(s.tokenTTL).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(s.jwtSecret)
}

func (s *AuthService) sanitizeUser(u *domain.User) *domain.User {
	if u == nil {
		return nil
	}
	cp := *u
	cp.PasswordHash = ""
	return &cp
}

func (s *AuthService) ParseToken(tokenString string) (*jwt.Token, jwt.MapClaims, error) {
	parsed, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, nil, err
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, nil, fmt.Errorf("invalid claims")
	}
	return parsed, claims, nil
}
