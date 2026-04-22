package rest

import (
	"net/http"
	"time"
)

func RegisterRoutes(mux *http.ServeMux, h *Handler) {
	authRL := NewRateLimiter(1*time.Minute, 10, 5*time.Minute)
	submitRL := NewRateLimiter(1*time.Minute, 20, 5*time.Minute)
	globalRL := NewRateLimiter(1*time.Minute, 120, 2*time.Minute)
	mux.HandleFunc("/healthz", h.HandleHealthz)
	mux.HandleFunc("/profile/init", h.FirebaseAuthRequired(h.HandleProfileInit))
	mux.HandleFunc("/profile", h.FirebaseAuthRequired(h.HandleProfileUpdate))
	mux.HandleFunc("/me", h.FirebaseAuthRequired(h.HandleMeFirebase))
	mux.HandleFunc("/dashboard/stats", h.FirebaseAuthRequired(h.HandleDashboardStats))
	mux.HandleFunc("/admin/ops/metrics", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminOpsMetrics)))
	mux.HandleFunc("/admin/users", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminUsers)))
	mux.HandleFunc("/admin/problems", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminProblems)))
	mux.HandleFunc("/admin/user-stats", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminUserStats)))
	mux.HandleFunc("/admin/user-submissions", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminUserSubmissions)))

	mux.HandleFunc("/problems", RateLimitMiddleware(globalRL, h.HandlePublicProblems))
	mux.HandleFunc("/problems/", RateLimitMiddleware(globalRL, h.HandlePublicProblem))
	mux.HandleFunc("/submissions", RateLimitMiddleware(submitRL, h.FirebaseAuthRequired(h.HandleSubmissions)))

	mux.HandleFunc("/rooms", h.FirebaseAuthRequired(h.HandleRooms))
	mux.HandleFunc("/rooms/", h.FirebaseAuthRequired(h.HandleRoomActions))
	mux.HandleFunc("/room-games/", h.FirebaseAuthRequired(h.HandleRoomGameActions))

	mux.HandleFunc("/auth/signup", RateLimitMiddleware(authRL, h.HandleSignUp))
	mux.HandleFunc("/auth/signin", RateLimitMiddleware(authRL, h.HandleSignIn))

	mux.HandleFunc("/matches", h.HandleCreateMatch)
	mux.HandleFunc("/matches/", h.HandleMatchActions)
}
