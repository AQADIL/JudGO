package domain

import "time"

type UserRole string

const (
	UserRoleUser  UserRole = "USER"
	UserRoleAdmin UserRole = "ADMIN"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"displayName"`
	PasswordHash string    `json:"passwordHash"`
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
