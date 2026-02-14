package rest

import "net/http"

func RegisterRoutes(mux *http.ServeMux, h *Handler) {
	mux.HandleFunc("/profile/init", h.FirebaseAuthRequired(h.HandleProfileInit))
	mux.HandleFunc("/me", h.FirebaseAuthRequired(h.HandleMeFirebase))
	mux.HandleFunc("/dashboard/stats", h.FirebaseAuthRequired(h.HandleDashboardStats))
	mux.HandleFunc("/admin/users", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminUsers)))
	mux.HandleFunc("/admin/problems", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminProblems)))
	mux.HandleFunc("/admin/user-stats", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminUserStats)))
	mux.HandleFunc("/admin/user-submissions", h.FirebaseAuthRequired(h.AdminOnly(h.HandleAdminUserSubmissions)))

	mux.HandleFunc("/problems/", h.HandlePublicProblem)
	mux.HandleFunc("/submissions", h.FirebaseAuthRequired(h.HandleSubmissions))

	mux.HandleFunc("/rooms", h.FirebaseAuthRequired(h.HandleRooms))
	mux.HandleFunc("/rooms/", h.FirebaseAuthRequired(h.HandleRoomActions))
	mux.HandleFunc("/room-games/", h.FirebaseAuthRequired(h.HandleRoomGameActions))

	mux.HandleFunc("/auth/signup", h.HandleSignUp)
	mux.HandleFunc("/auth/signin", h.HandleSignIn)

	mux.HandleFunc("/matches", h.HandleCreateMatch)
	mux.HandleFunc("/matches/", h.HandleMatchActions)
}
