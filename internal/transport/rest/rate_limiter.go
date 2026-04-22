package rest

import (
	"net"
	"net/http"
	"sync"
	"time"
)

type visitor struct {
	lastSeen time.Time
	count    int
	blocked  bool
}

type RateLimiter struct {
	mu          sync.RWMutex
	visitors    map[string]*visitor
	window      time.Duration
	maxRequests int
	blockDur    time.Duration
}

func NewRateLimiter(window time.Duration, maxRequests int, blockDur time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors:    make(map[string]*visitor),
		window:      window,
		maxRequests: maxRequests,
		blockDur:    blockDur,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, v := range rl.visitors {
			if now.Sub(v.lastSeen) > rl.blockDur {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{lastSeen: now, count: 1}
		return true
	}

	if v.blocked && now.Sub(v.lastSeen) < rl.blockDur {
		v.lastSeen = now
		return false
	}

	if now.Sub(v.lastSeen) > rl.window {
		v.count = 1
		v.lastSeen = now
		v.blocked = false
		return true
	}

	v.count++
	v.lastSeen = now
	if v.count > rl.maxRequests {
		v.blocked = true
		return false
	}
	return true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := indexByte(xff, ','); idx > 0 {
			return xff[:idx]
		}
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func RateLimitMiddleware(rl *RateLimiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !rl.Allow(ip) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, `{"error":"too many requests"}`, http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}
