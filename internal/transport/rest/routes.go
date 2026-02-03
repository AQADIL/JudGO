package rest

import "net/http"

func RegisterRoutes(mux *http.ServeMux, h *Handler) {
	mux.HandleFunc("/matches", h.HandleCreateMatch)
	mux.HandleFunc("/matches/", h.HandleMatchActions)
}
