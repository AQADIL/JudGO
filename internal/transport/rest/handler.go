package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"firebase.google.com/go/v4/auth"

	"github.com/AQADIL/JudGO/internal/domain"
	firebaseRepo "github.com/AQADIL/JudGO/internal/repository/firebase"
	"github.com/AQADIL/JudGO/internal/service"
)

type Handler struct {
	matchService *service.MatchService
	roomService  *service.RoomService
	roomGameSvc  *service.RoomGameService
	problemSvc   *service.ProblemService
	judgeSvc     *service.JudgeService
	authService  *service.AuthService
	fbAuth       *auth.Client
	userRepo     firebaseRepo.UserRepository
	practiceRepo firebaseRepo.PracticeRepository
}

func NewHandler(ms *service.MatchService, rs *service.RoomService, rgs *service.RoomGameService, ps *service.ProblemService, js *service.JudgeService, as *service.AuthService, fbAuth *auth.Client, userRepo firebaseRepo.UserRepository, practiceRepo firebaseRepo.PracticeRepository) *Handler {
	return &Handler{matchService: ms, roomService: rs, roomGameSvc: rgs, problemSvc: ps, judgeSvc: js, authService: as, fbAuth: fbAuth, userRepo: userRepo, practiceRepo: practiceRepo}
}

type createMatchRequest struct {
	Type    string `json:"type"`
	Player1 string `json:"player1"`
}

type joinMatchRequest struct {
	Player2 string `json:"player2"`
}

type submitRequest struct {
	Player string `json:"player"`
	Code   string `json:"code"`
}

type signUpRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type signInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type createRoomRequest struct {
	Name      string              `json:"name"`
	IsPrivate bool                `json:"isPrivate"`
	Password  string              `json:"password"`
	Settings  domain.RoomSettings `json:"settings"`
}

type joinRoomRequest struct {
	Password string `json:"password"`
}

type submitRoomGameRequest struct {
	ProblemID string `json:"problemId"`
	Code      string `json:"code"`
}

type createProblemRequest struct {
	Problem domain.Problem `json:"problem"`
}

type createSubmissionRequest struct {
	ProblemID string `json:"problemId"`
	Language  string `json:"language"`
	Code      string `json:"code"`
}

type ctxKey string

const (
	ctxUserIDKey ctxKey = "userID"
	ctxEmailKey  ctxKey = "email"
	ctxRoleKey   ctxKey = "role"
)

type profileInitResponse struct {
	User *domain.User `json:"user"`
}

type updateProfileRequest struct {
	DisplayName string `json:"displayName"`
}

type dashboardStatsResponse struct {
	SolvedTotal              int            `json:"solvedTotal"`
	SubmissionsTotal         int            `json:"submissionsTotal"`
	PassedTotal              int            `json:"passedTotal"`
	PassRate                 float64        `json:"passRate"`
	SolvedByDifficulty       map[string]int `json:"solvedByDifficulty"`
	SubmissionsByLanguage    map[string]int `json:"submissionsByLanguage"`
	AttemptsToSolveHistogram map[string]int `json:"attemptsToSolveHistogram"`
	DailySubmissions         []dailyCount   `json:"dailySubmissions"`
	DailySolved              []dailyCount   `json:"dailySolved"`
}

type dailyCount struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

func (h *Handler) FirebaseAuthRequired(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.handleCORS(w, r) {
			return
		}
		hdr := r.Header.Get("Authorization")
		if hdr == "" || !strings.HasPrefix(hdr, "Bearer ") {
			h.writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		idToken := strings.TrimPrefix(hdr, "Bearer ")
		tok, err := h.fbAuth.VerifyIDToken(r.Context(), idToken)
		if err != nil {
			h.writeError(w, http.StatusUnauthorized, "invalid firebase token")
			return
		}
		uid := tok.UID
		email, _ := tok.Claims["email"].(string)

		role := string(domain.UserRoleUser)
		if email != "" {
			if u, err := h.userRepo.GetByEmail(r.Context(), email); err == nil && u != nil {
				role = string(u.Role)
			}
		}

		ctx := context.WithValue(r.Context(), ctxUserIDKey, uid)
		ctx = context.WithValue(ctx, ctxEmailKey, email)
		ctx = context.WithValue(ctx, ctxRoleKey, role)
		next(w, r.WithContext(ctx))
	}
}

func (h *Handler) AdminOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(ctxRoleKey).(string)
		if role != string(domain.UserRoleAdmin) {
			h.writeError(w, http.StatusForbidden, "admin only")
			return
		}
		next(w, r)
	}
}

func (h *Handler) HandleProfileInit(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	hdr := r.Header.Get("Authorization")
	if hdr == "" || !strings.HasPrefix(hdr, "Bearer ") {
		h.writeError(w, http.StatusUnauthorized, "missing bearer token")
		return
	}
	idToken := strings.TrimPrefix(hdr, "Bearer ")
	tok, err := h.fbAuth.VerifyIDToken(r.Context(), idToken)
	if err != nil {
		h.writeError(w, http.StatusUnauthorized, "invalid firebase token")
		return
	}

	uid := tok.UID
	email, _ := tok.Claims["email"].(string)
	name, _ := tok.Claims["name"].(string)
	if name == "" {
		name, _ = tok.Claims["displayName"].(string)
	}
	if email == "" {
		h.writeError(w, http.StatusBadRequest, "email is missing in token")
		return
	}

	// If user exists by email, do nothing. Otherwise create.
	if _, err := h.userRepo.GetByEmail(r.Context(), email); err != nil {
		count, err2 := h.userRepo.Count(r.Context())
		if err2 != nil {
			h.writeError(w, http.StatusInternalServerError, "failed to count users")
			return
		}
		role := domain.UserRoleUser
		if count == 0 {
			role = domain.UserRoleAdmin
		}
		now := time.Now().UTC()
		u := &domain.User{
			ID:          uid,
			Email:       strings.ToLower(strings.TrimSpace(email)),
			DisplayName: name,
			Role:        role,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := h.userRepo.Create(r.Context(), u); err != nil {
			h.writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create profile: %v", err))
			return
		}
	}

	u, err := h.userRepo.GetByEmail(r.Context(), email)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to load profile")
		return
	}
	u.PasswordHash = ""
	writeJSON(w, http.StatusOK, profileInitResponse{User: u})
}

func (h *Handler) HandleMeFirebase(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(ctxUserIDKey).(string)
	email, _ := r.Context().Value(ctxEmailKey).(string)
	if email == "" {
		h.writeError(w, http.StatusBadRequest, "email is missing in context")
		return
	}

	u, err := h.userRepo.GetByEmail(r.Context(), email)
	if err != nil {
		// Fallback: if index isn't ready, at least return uid
		writeJSON(w, http.StatusOK, map[string]string{"userId": uid, "email": email})
		return
	}
	u.PasswordHash = ""
	writeJSON(w, http.StatusOK, u)
}

func (h *Handler) HandleProfileUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	email, _ := r.Context().Value(ctxEmailKey).(string)
	if email == "" {
		h.writeError(w, http.StatusBadRequest, "email is missing in context")
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	dn := strings.TrimSpace(req.DisplayName)
	if dn == "" {
		h.writeError(w, http.StatusBadRequest, "displayName is required")
		return
	}
	if len([]rune(dn)) > 32 {
		h.writeError(w, http.StatusBadRequest, "displayName too long")
		return
	}

	u, err := h.userRepo.GetByEmail(r.Context(), email)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to load profile")
		return
	}

	u.DisplayName = dn
	u.UpdatedAt = time.Now().UTC()
	if err := h.userRepo.Update(r.Context(), u); err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	u.PasswordHash = ""
	writeJSON(w, http.StatusOK, u)
}

func (h *Handler) HandleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	users, err := h.userRepo.List(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *Handler) HandleAdminUserStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.practiceRepo == nil {
		h.writeError(w, http.StatusNotImplemented, "practice repository not configured")
		return
	}

	// Get optional userID query param - if provided, return stats for specific user
	userID := r.URL.Query().Get("userId")

	// Get all users first
	users, err := h.userRepo.List(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}

	// Get problem difficulties for reference
	probDifficulty := map[string]string{}
	if h.problemSvc != nil {
		if list, perr := h.problemSvc.ListAdmin(r.Context()); perr == nil {
			for _, p := range list {
				if p == nil {
					continue
				}
				probDifficulty[p.ID] = string(p.Difficulty)
			}
		}
	}

	result := make([]map[string]interface{}, 0)

	for _, u := range users {
		// If specific user requested, skip others
		if userID != "" && u.ID != userID {
			continue
		}

		solved, err := h.practiceRepo.ListSolved(r.Context(), u.ID)
		if err != nil {
			continue
		}

		subs, err := h.practiceRepo.ListSubmissions(r.Context(), u.ID)
		if err != nil {
			continue
		}

		// Calculate stats
		totalSubmissions := len(subs)
		passedSubmissions := 0
		subsByLanguage := map[string]int{}
		attemptsByProblem := map[string]int{}

		for _, s := range subs {
			if s.Passed {
				passedSubmissions++
			}
			l := strings.ToUpper(strings.TrimSpace(s.Language))
			if l == "" {
				l = "UNKNOWN"
			}
			subsByLanguage[l]++
			attemptsByProblem[s.ProblemID]++
		}

		// Build solved problems details
		solvedProblems := make([]map[string]interface{}, 0)
		for pid, rec := range solved {
			solvedProblems = append(solvedProblems, map[string]interface{}{
				"problemId":       pid,
				"difficulty":      probDifficulty[pid],
				"attemptsToSolve": rec.AttemptsToSolve,
				"solvedAt":        rec.SolvedAt,
			})
		}

		// Calculate success rate
		successRate := 0.0
		if totalSubmissions > 0 {
			successRate = float64(passedSubmissions) / float64(totalSubmissions) * 100
		}

		userStats := map[string]interface{}{
			"userId":                u.ID,
			"email":                 u.Email,
			"displayName":           u.DisplayName,
			"role":                  u.Role,
			"totalSubmissions":      totalSubmissions,
			"passedCount":           passedSubmissions,
			"solvedCount":           len(solved),
			"successRate":           math.Round(successRate*100) / 100,
			"submissionsByLanguage": subsByLanguage,
			"solvedProblems":        solvedProblems,
			"joinedAt":              u.CreatedAt,
		}

		result = append(result, userStats)
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) HandleAdminUserSubmissions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.practiceRepo == nil {
		h.writeError(w, http.StatusNotImplemented, "practice repository not configured")
		return
	}

	// Get userID from query param
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		h.writeError(w, http.StatusBadRequest, "userId is required")
		return
	}

	// Get all submissions for user
	subs, err := h.practiceRepo.ListSubmissions(r.Context(), userID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list submissions")
		return
	}

	// Get problem difficulties for reference
	probDifficulty := map[string]string{}
	if h.problemSvc != nil {
		if list, perr := h.problemSvc.ListAdmin(r.Context()); perr == nil {
			for _, p := range list {
				if p == nil {
					continue
				}
				probDifficulty[p.ID] = string(p.Difficulty)
			}
		}
	}

	// Build response with all submission details
	result := make([]map[string]interface{}, 0, len(subs))
	for _, s := range subs {
		result = append(result, map[string]interface{}{
			"problemId":     s.ProblemID,
			"difficulty":    probDifficulty[s.ProblemID],
			"language":      strings.ToUpper(strings.TrimSpace(s.Language)),
			"passed":        s.Passed,
			"passedCount":   s.PassedCount,
			"totalCount":    s.TotalCount,
			"attemptNumber": s.AttemptNumber,
			"createdAt":     s.CreatedAt,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) HandleAdminProblems(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	if r.Method == http.MethodGet {
		items, err := h.problemSvc.ListAdmin(r.Context())
		if err != nil {
			h.writeError(w, http.StatusInternalServerError, "failed to list problems")
			return
		}
		writeJSON(w, http.StatusOK, items)
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req createProblemRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	created, err := h.problemSvc.Create(r.Context(), &req.Problem)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) HandlePublicProblem(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/problems/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	id := parts[0]
	p, err := h.problemSvc.GetPublic(r.Context(), id)
	if err != nil {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "not found") {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) HandleSubmissions(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.judgeSvc == nil {
		h.writeError(w, http.StatusNotImplemented, "judge is not configured")
		return
	}

	var req createSubmissionRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	userID, _ := r.Context().Value(ctxUserIDKey).(string)
	lang := service.JudgeLanguage(strings.ToLower(strings.TrimSpace(req.Language)))
	jr, err := h.judgeSvc.Judge(r.Context(), req.ProblemID, lang, req.Code, 5*time.Second)
	if err != nil {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "disabled") {
			h.writeError(w, http.StatusNotImplemented, err.Error())
			return
		}
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	attemptNumber := 0
	if h.practiceRepo != nil && userID != "" && strings.TrimSpace(req.ProblemID) != "" {
		if n, perr := h.practiceRepo.NextAttemptNumber(r.Context(), userID, req.ProblemID); perr == nil {
			attemptNumber = n
			_ = h.practiceRepo.Create(r.Context(), &firebaseRepo.PracticeSubmission{
				UserID:        userID,
				ProblemID:     strings.TrimSpace(req.ProblemID),
				Language:      strings.TrimSpace(req.Language),
				Code:          req.Code,
				AttemptNumber: n,
				Passed:        jr.Passed,
				PassedCount:   jr.PassedCnt,
				TotalCount:    jr.TotalCnt,
				CreatedAt:     time.Now().UTC(),
			})
			if jr.Passed {
				_ = h.practiceRepo.MarkSolvedIfFirst(r.Context(), userID, req.ProblemID, n)
			}
		} else if perr != nil {
			log.Printf("[SUBMISSION] failed to increment attempt counter: %v", perr)
		}
	}

	resp := struct {
		*service.JudgeResult
		AttemptNumber int `json:"attemptNumber"`
	}{
		JudgeResult:   jr,
		AttemptNumber: attemptNumber,
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) HandleRooms(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}

	if r.Method == http.MethodGet {
		rooms, err := h.roomService.ListRooms(r.Context())
		if err != nil {
			h.writeError(w, http.StatusInternalServerError, "failed to list rooms")
			return
		}
		writeJSON(w, http.StatusOK, rooms)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(ctxUserIDKey).(string)
	email, _ := r.Context().Value(ctxEmailKey).(string)
	displayName := ""
	if email != "" {
		if u, err := h.userRepo.GetByEmail(r.Context(), email); err == nil && u != nil {
			displayName = u.DisplayName
			if displayName == "" {
				displayName = u.Email
			}
		}
	}
	if displayName == "" {
		if email != "" {
			displayName = email
		} else {
			displayName = userID
		}
	}

	var req createRoomRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	room, err := h.roomService.CreateRoom(r.Context(), userID, displayName, req.Name, req.IsPrivate, req.Password, req.Settings)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, room)
}

// HandleRoomActions handles /rooms/{code} and /rooms/{code}/join
func (h *Handler) HandleRoomActions(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	code := parts[0]

	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			viewerID, _ := r.Context().Value(ctxUserIDKey).(string)
			room, err := h.roomService.GetRoom(r.Context(), code)
			if err != nil {
				h.writeError(w, http.StatusNotFound, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, service.RedactRoomForViewer(room, viewerID))
			return
		case http.MethodDelete:
			userID, _ := r.Context().Value(ctxUserIDKey).(string)
			if err := h.roomService.DeleteRoom(r.Context(), code, userID); err != nil {
				h.writeError(w, http.StatusForbidden, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
			return
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
	}

	if len(parts) == 2 && parts[1] == "join" {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		userID, _ := r.Context().Value(ctxUserIDKey).(string)
		email, _ := r.Context().Value(ctxEmailKey).(string)
		displayName := ""
		if email != "" {
			if u, err := h.userRepo.GetByEmail(r.Context(), email); err == nil && u != nil {
				displayName = u.DisplayName
				if displayName == "" {
					displayName = u.Email
				}
			}
		}
		if displayName == "" {
			if email != "" {
				displayName = email
			} else {
				displayName = userID
			}
		}

		var req joinRoomRequest
		if err := decodeStrictJSON(r, &req); err != nil {
			h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}

		room, err := h.roomService.JoinRoom(r.Context(), code, userID, displayName, req.Password)
		if err != nil {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, service.RedactRoomForViewer(room, userID))
		return
	}

	if len(parts) == 2 && parts[1] == "start" {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		userID, _ := r.Context().Value(ctxUserIDKey).(string)
		room, err := h.roomService.GetRoom(r.Context(), code)
		if err != nil {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		// create game session first
		g, err := h.roomGameSvc.CreateFromRoom(r.Context(), room)
		if err != nil {
			h.writeError(w, http.StatusInternalServerError, "failed to create room game")
			return
		}
		started, err := h.roomService.StartRoom(r.Context(), code, userID, g.ID)
		if err != nil {
			h.writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, service.RedactRoomForViewer(started, userID))
		return
	}

	if len(parts) == 2 && parts[1] == "leave" {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		userID, _ := r.Context().Value(ctxUserIDKey).(string)
		current, err := h.roomService.GetRoom(r.Context(), code)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "not found") {
				writeJSON(w, http.StatusOK, map[string]bool{"left": true})
				return
			}
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		if current.OwnerUserID == userID {
			if current.ActiveGameID != "" {
				_ = h.roomGameSvc.Delete(r.Context(), current.ActiveGameID)
			}
			if err := h.roomService.ForceDeleteRoom(r.Context(), code); err != nil {
				h.writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
			return
		}

		room, err := h.roomService.LeaveRoom(r.Context(), code, userID)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "not found") {
				writeJSON(w, http.StatusOK, map[string]bool{"left": true})
				return
			}
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, room)
		return
	}

	w.WriteHeader(http.StatusNotFound)
}

// HandleRoomGameActions handles /room-games/{id} and /room-games/{id}/submit
func (h *Handler) HandleRoomGameActions(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/room-games/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	gameID := parts[0]

	if len(parts) == 1 {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		userID, _ := r.Context().Value(ctxUserIDKey).(string)
		g, err := h.roomGameSvc.Get(r.Context(), gameID)
		if err != nil {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		if g != nil {
			g.MyUserID = userID
		}
		if g != nil && g.Status == domain.RoomGameStatusFinished && g.FinishedAt != nil {
			if time.Since(*g.FinishedAt) > 5*time.Second {
				if g.RoomCode != "" {
					_ = h.roomService.ForceDeleteRoom(r.Context(), g.RoomCode)
				}
				_ = h.roomGameSvc.Delete(r.Context(), gameID)
				h.writeError(w, http.StatusNotFound, "game not found")
				return
			}
		}
		writeJSON(w, http.StatusOK, g)
		return
	}

	if len(parts) == 2 && parts[1] == "submit" {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		userID, _ := r.Context().Value(ctxUserIDKey).(string)
		email, _ := r.Context().Value(ctxEmailKey).(string)
		displayName := ""
		if email != "" {
			if u, err := h.userRepo.GetByEmail(r.Context(), email); err == nil && u != nil {
				displayName = u.DisplayName
				if displayName == "" {
					displayName = u.Email
				}
			}
		}
		if displayName == "" {
			if email != "" {
				displayName = email
			} else {
				displayName = userID
			}
		}

		var req submitRoomGameRequest
		if err := decodeStrictJSON(r, &req); err != nil {
			h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}
		g, sub, err := h.roomGameSvc.Submit(r.Context(), gameID, userID, displayName, req.ProblemID, req.Code)
		if err != nil {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if g != nil {
			g.MyUserID = userID
		}
		if g != nil && g.Status == domain.RoomGameStatusFinished {
			if g.RoomCode != "" {
				_ = h.roomService.ForceDeleteRoom(r.Context(), g.RoomCode)
			}
			_ = h.roomGameSvc.Delete(r.Context(), gameID)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"game": g, "submission": sub})
		return
	}

	w.WriteHeader(http.StatusNotFound)
}

func (h *Handler) HandleSignUp(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req signUpRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	res, err := h.authService.Signup(r.Context(), req.Email, req.Password, req.DisplayName)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (h *Handler) HandleSignIn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req signInRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	res, err := h.authService.Signin(r.Context(), req.Email, req.Password)
	if err != nil {
		h.writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
	// JWT-based legacy endpoint (kept for now). Prefer Firebase + /profile/init.
	userID, _ := r.Context().Value(ctxUserIDKey).(string)
	role, _ := r.Context().Value(ctxRoleKey).(string)
	writeJSON(w, http.StatusOK, map[string]string{"userId": userID, "role": role})
}

func (h *Handler) HandleDashboardStats(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(ctxUserIDKey).(string)
	userID = strings.TrimSpace(userID)
	if userID == "" {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if h.practiceRepo == nil {
		writeJSON(w, http.StatusOK, &dashboardStatsResponse{})
		return
	}

	solved, err := h.practiceRepo.ListSolved(r.Context(), userID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	subs, err := h.practiceRepo.ListSubmissions(r.Context(), userID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	probDifficulty := map[string]string{}
	if h.problemSvc != nil {
		if list, perr := h.problemSvc.ListAdmin(r.Context()); perr == nil {
			for _, p := range list {
				if p == nil {
					continue
				}
				probDifficulty[p.ID] = string(p.Difficulty)
			}
		}
	}

	passedTotal := 0
	subsByLang := map[string]int{}
	daySubs := map[string]int{}
	for _, s := range subs {
		if s.Passed {
			passedTotal++
		}
		l := strings.ToUpper(strings.TrimSpace(s.Language))
		if l == "" {
			l = "UNKNOWN"
		}
		subsByLang[l]++
		if !s.CreatedAt.IsZero() {
			k := s.CreatedAt.UTC().Format("2006-01-02")
			daySubs[k]++
		}
	}

	solvedByDiff := map[string]int{"EASY": 0, "MEDIUM": 0, "HARD": 0, "UNKNOWN": 0}
	attemptHist := map[string]int{"1": 0, "2": 0, "3": 0, "4": 0, "5+": 0}
	daySolved := map[string]int{}
	for pid, rec := range solved {
		d := strings.ToUpper(strings.TrimSpace(probDifficulty[pid]))
		if d == "" {
			d = "UNKNOWN"
		}
		solvedByDiff[d]++
		if rec.AttemptsToSolve <= 1 {
			attemptHist["1"]++
		} else if rec.AttemptsToSolve == 2 {
			attemptHist["2"]++
		} else if rec.AttemptsToSolve == 3 {
			attemptHist["3"]++
		} else if rec.AttemptsToSolve == 4 {
			attemptHist["4"]++
		} else {
			attemptHist["5+"]++
		}
		if !rec.SolvedAt.IsZero() {
			k := rec.SolvedAt.UTC().Format("2006-01-02")
			daySolved[k]++
		}
	}

	now := time.Now().UTC()
	makeSeries := func(m map[string]int) []dailyCount {
		out := make([]dailyCount, 0, 14)
		for i := 13; i >= 0; i-- {
			d := now.AddDate(0, 0, -i).Format("2006-01-02")
			out = append(out, dailyCount{Day: d, Count: m[d]})
		}
		return out
	}

	passRate := 0.0
	if len(subs) > 0 {
		passRate = float64(passedTotal) / float64(len(subs))
	}

	resp := &dashboardStatsResponse{
		SolvedTotal:              len(solved),
		SubmissionsTotal:         len(subs),
		PassedTotal:              passedTotal,
		PassRate:                 passRate,
		SolvedByDifficulty:       solvedByDiff,
		SubmissionsByLanguage:    subsByLang,
		AttemptsToSolveHistogram: attemptHist,
		DailySubmissions:         makeSeries(daySubs),
		DailySolved:              makeSeries(daySolved),
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) HandleNotFound(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	h.writeError(w, http.StatusNotFound, "not found")
}

func (h *Handler) AuthRequired(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.handleCORS(w, r) {
			return
		}
		hdr := r.Header.Get("Authorization")
		if hdr == "" || !strings.HasPrefix(hdr, "Bearer ") {
			h.writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		tok := strings.TrimPrefix(hdr, "Bearer ")
		_, claims, err := h.authService.ParseToken(tok)
		if err != nil {
			h.writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		uid, _ := claims["sub"].(string)
		role, _ := claims["role"].(string)
		ctx := context.WithValue(r.Context(), ctxUserIDKey, uid)
		ctx = context.WithValue(ctx, ctxRoleKey, role)
		next(w, r.WithContext(ctx))
	}
}

func (h *Handler) handleCORS(w http.ResponseWriter, r *http.Request) bool {
	allowed := os.Getenv("CORS_ORIGIN")
	reqOrigin := r.Header.Get("Origin")

	// Dev-friendly defaults:
	// - empty: allow localhost:5173 and any same-lan origin (http://<ip>:5173)
	// - '*': reflect request origin (best for dev with Authorization header)
	// - comma-separated list: exact match
	allowOrigin := ""
	if allowed == "*" {
		allowOrigin = reqOrigin
	} else if allowed != "" {
		parts := strings.Split(allowed, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" && p == reqOrigin {
				allowOrigin = reqOrigin
				break
			}
		}
	} else {
		// Default dev mode: reflect request origin (works for localhost and LAN IPs).
		// This is safe for local development; in production set CORS_ORIGIN explicitly.
		if reqOrigin != "" {
			allowOrigin = reqOrigin
		}
	}
	if allowOrigin == "" {
		allowOrigin = "http://localhost:5173"
	}

	w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Vary", "Origin")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return false
	}
	return true
}

func (h *Handler) HandleCreateMatch(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req createMatchRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Type == "" || req.Player1 == "" {
		h.writeError(w, http.StatusBadRequest, "type and player1 are required")
		return
	}

	match, err := h.matchService.CreateMatch(r.Context(), req.Type, req.Player1)
	if err != nil {
		log.Printf("[HTTP] failed to create match: %v", err)
		h.writeError(w, http.StatusInternalServerError, "failed to create match")
		return
	}

	writeJSON(w, http.StatusCreated, match)
}

// HandleMatchActions обрабатывает маршруты вида /matches/{id}/join и /matches/{id}/submit.
func (h *Handler) HandleMatchActions(w http.ResponseWriter, r *http.Request) {
	if !h.handleCORS(w, r) {
		return
	}
	// Обрезаем префикс "/matches/" и разбираем action.
	path := strings.TrimPrefix(r.URL.Path, "/matches/")
	parts := strings.Split(path, "/")
	if len(parts) != 2 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	id, action := parts[0], parts[1]

	switch action {
	case "join":
		h.handleJoinMatch(w, r, id)
	case "submit":
		h.handleSubmit(w, r, id)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (h *Handler) handleJoinMatch(w http.ResponseWriter, r *http.Request, matchID string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req joinMatchRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Player2 == "" {
		h.writeError(w, http.StatusBadRequest, "player2 is required")
		return
	}

	match, err := h.matchService.JoinMatch(r.Context(), matchID, req.Player2)
	if err != nil {
		log.Printf("[HTTP] failed to join match %s: %v", matchID, err)
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, match)
}

func (h *Handler) handleSubmit(w http.ResponseWriter, r *http.Request, matchID string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req submitRequest
	if err := decodeStrictJSON(r, &req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Player == "" || req.Code == "" {
		h.writeError(w, http.StatusBadRequest, "player and code are required")
		return
	}

	match, err := h.matchService.GetMatch(r.Context(), matchID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "match not found")
		return
	}

	if h.judgeSvc == nil {
		h.writeError(w, http.StatusNotImplemented, "judge is not configured")
		return
	}

	problemID := match.ProblemID
	if problemID == "" {
		problemID = "easy-3-single-number"
	}

	lang := service.JudgeLanguage(strings.ToLower(string(match.Language)))
	if lang == "" {
		lang = service.JudgeLanguageGo
	}

	jr, err := h.judgeSvc.Judge(r.Context(), problemID, lang, req.Code, 5*time.Second)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	delta := 0
	if jr.Passed {
		delta = 100
	}
	finish := jr.Passed

	_, _ = h.matchService.UpdateScore(r.Context(), matchID, req.Player, delta, finish)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"passed":      jr.Passed,
		"passedCount": jr.PassedCnt,
		"totalCount":  jr.TotalCnt,
		"results":     jr.Results,
		"matchId":     matchID,
		"player":      req.Player,
		"finished":    finish,
	})
}

// Вспомогательные функции для JSON.

func decodeStrictJSON(r *http.Request, dst interface{}) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("[HTTP] failed to encode JSON response: %v", err)
	}
}

func (h *Handler) writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
