package rest

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/AQADIL/JudGO/internal/service"
	"github.com/AQADIL/JudGO/pkg/sandbox"
)

type Handler struct {
	matchService *service.MatchService
}

func NewHandler(ms *service.MatchService) *Handler {
	return &Handler{matchService: ms}
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

func (h *Handler) HandleCreateMatch(w http.ResponseWriter, r *http.Request) {
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

func (h *Handler) HandleMatchActions(w http.ResponseWriter, r *http.Request) {

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
		h.writeError(w, http.StatusInternalServerError, "failed to join match")
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

	status, score := sandbox.RunMock(req.Code)
	finish := status == "Accepted"

	match, err := h.matchService.UpdateScore(r.Context(), matchID, req.Player, score, finish)
	if err != nil {
		log.Printf("[HTTP] failed to submit code for match %s: %v", matchID, err)
		h.writeError(w, http.StatusInternalServerError, "failed to submit code")
		return
	}

	resp := map[string]interface{}{
		"status": status,
		"score":  score,
		"match":  match,
	}
	writeJSON(w, http.StatusOK, resp)
}

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
