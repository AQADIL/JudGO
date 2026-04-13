package service

import (
	"context"
	"fmt"
	"math"
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/AQADIL/JudGO/internal/domain"
	firebaseRepo "github.com/AQADIL/JudGO/internal/repository/firebase"
)

type OpsDailyCount struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

type OpsSystemSnapshot struct {
	Hostname               string    `json:"hostname"`
	OS                     string    `json:"os"`
	Arch                   string    `json:"arch"`
	GoVersion              string    `json:"goVersion"`
	StartedAt              time.Time `json:"startedAt"`
	UptimeSec              int64     `json:"uptimeSec"`
	CPUCores               int       `json:"cpuCores"`
	SystemCPUPercent       float64   `json:"systemCpuPercent"`
	ProcessCPUPercent      float64   `json:"processCpuPercent"`
	Load1                  float64   `json:"load1"`
	Load5                  float64   `json:"load5"`
	Load15                 float64   `json:"load15"`
	SystemMemoryTotalMB    float64   `json:"systemMemoryTotalMB"`
	SystemMemoryUsedMB     float64   `json:"systemMemoryUsedMB"`
	SystemMemoryUsedPct    float64   `json:"systemMemoryUsedPct"`
	ContainerMemoryLimitMB float64   `json:"containerMemoryLimitMB"`
	ContainerMemoryUsedMB  float64   `json:"containerMemoryUsedMB"`
	ContainerMemoryUsedPct float64   `json:"containerMemoryUsedPct"`
	ProcessRSSMB           float64   `json:"processRssMB"`
	GoAllocMB              float64   `json:"goAllocMB"`
	GoHeapSysMB            float64   `json:"goHeapSysMB"`
	GoSysMB                float64   `json:"goSysMB"`
	Goroutines             int       `json:"goroutines"`
	GCCount                uint32    `json:"gcCount"`
}

type OpsPlatformSnapshot struct {
	TotalUsers         int             `json:"totalUsers"`
	AdminUsers         int             `json:"adminUsers"`
	NewUsers24h        int             `json:"newUsers24h"`
	TotalProblems      int             `json:"totalProblems"`
	PublishedProblems  int             `json:"publishedProblems"`
	DraftProblems      int             `json:"draftProblems"`
	ArchivedProblems   int             `json:"archivedProblems"`
	TotalSubmissions   int             `json:"totalSubmissions"`
	PassedSubmissions  int             `json:"passedSubmissions"`
	PassRatePct        float64         `json:"passRatePct"`
	SolvedEvents       int             `json:"solvedEvents"`
	Submissions24h     int             `json:"submissions24h"`
	Solved24h          int             `json:"solved24h"`
	SubmissionsByLang  map[string]int  `json:"submissionsByLang"`
	SolvedByDifficulty map[string]int  `json:"solvedByDifficulty"`
	SubmissionsDaily   []OpsDailyCount `json:"submissionsDaily"`
	SolvedDaily        []OpsDailyCount `json:"solvedDaily"`
	ActiveRooms        int             `json:"activeRooms"`
	WaitingRooms       int             `json:"waitingRooms"`
	RunningRooms       int             `json:"runningRooms"`
	PrivateRooms       int             `json:"privateRooms"`
	RunningGames       int             `json:"runningGames"`
	LivePlayers        int             `json:"livePlayers"`
}

type OpsSecuritySnapshot struct {
	UnauthorizedTotal    int64 `json:"unauthorizedTotal"`
	ForbiddenTotal       int64 `json:"forbiddenTotal"`
	InvalidPasswordTotal int64 `json:"invalidPasswordTotal"`
}

type OpsHTTPWindowSnapshot struct {
	WindowSec          int     `json:"windowSec"`
	TotalRequests      int64   `json:"totalRequests"`
	Status2xx          int64   `json:"status2xx"`
	Status3xx          int64   `json:"status3xx"`
	Status4xx          int64   `json:"status4xx"`
	Status5xx          int64   `json:"status5xx"`
	RequestRatePerMin  float64 `json:"requestRatePerMin"`
	RedirectRatePct    float64 `json:"redirectRatePct"`
	ClientErrorRatePct float64 `json:"clientErrorRatePct"`
	ServerErrorRatePct float64 `json:"serverErrorRatePct"`
	LatencyAvgMs       float64 `json:"latencyAvgMs"`
	LatencyP95Ms       float64 `json:"latencyP95Ms"`
}

type OpsHTTPSnapshot struct {
	TotalRequests  int64                 `json:"totalRequests"`
	Status2xxTotal int64                 `json:"status2xxTotal"`
	Status3xxTotal int64                 `json:"status3xxTotal"`
	Status4xxTotal int64                 `json:"status4xxTotal"`
	Status5xxTotal int64                 `json:"status5xxTotal"`
	Last30Sec      OpsHTTPWindowSnapshot `json:"last30Sec"`
	Last120Sec     OpsHTTPWindowSnapshot `json:"last120Sec"`
}

type OpsHealthSnapshot struct {
	Alive     bool      `json:"alive"`
	Ready     bool      `json:"ready"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CheckedAt time.Time `json:"checkedAt"`
}

type OpsAlert struct {
	ID       string `json:"id"`
	Severity string `json:"severity"`
	Signal   string `json:"signal"`
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	Note     string `json:"note"`
	Runbook  string `json:"runbook"`
}

type OpsSnapshot struct {
	GeneratedAt time.Time            `json:"generatedAt"`
	System      OpsSystemSnapshot    `json:"system"`
	Platform    OpsPlatformSnapshot  `json:"platform"`
	Judge       JudgeMetricsSnapshot `json:"judge"`
	Security    OpsSecuritySnapshot  `json:"security"`
	HTTP        OpsHTTPSnapshot      `json:"http"`
	Health      OpsHealthSnapshot    `json:"health"`
	Alerts      []OpsAlert           `json:"alerts"`
}

type cpuCounters struct {
	total uint64
	idle  uint64
	proc  uint64
	valid bool
}

type httpObservation struct {
	at         time.Time
	status     int
	durationMs float64
}

type OpsService struct {
	userRepo     firebaseRepo.UserRepository
	practiceRepo firebaseRepo.PracticeRepository
	roomSvc      *RoomService
	problemSvc   *ProblemService
	judgeSvc     *JudgeService
	startedAt    time.Time

	cacheMu  sync.Mutex
	cachedAt time.Time
	cached   *OpsSnapshot
	cpuMu    sync.Mutex
	cpuPrev  cpuCounters

	unauthorizedTotal    int64
	forbiddenTotal       int64
	invalidPasswordTotal int64
	totalRequests        int64
	status2xxTotal       int64
	status3xxTotal       int64
	status4xxTotal       int64
	status5xxTotal       int64
	httpMu               sync.Mutex
	httpObservations     []httpObservation
}

func NewOpsService(userRepo firebaseRepo.UserRepository, practiceRepo firebaseRepo.PracticeRepository, roomSvc *RoomService, problemSvc *ProblemService, judgeSvc *JudgeService) *OpsService {
	return &OpsService{userRepo: userRepo, practiceRepo: practiceRepo, roomSvc: roomSvc, problemSvc: problemSvc, judgeSvc: judgeSvc, startedAt: time.Now().UTC()}
}

func (s *OpsService) RecordHTTPError(status int, msg string) {
	lower := strings.ToLower(strings.TrimSpace(msg))
	if status == 401 {
		atomic.AddInt64(&s.unauthorizedTotal, 1)
	}
	if status == 403 {
		atomic.AddInt64(&s.forbiddenTotal, 1)
	}
	if strings.Contains(lower, "invalid password") {
		atomic.AddInt64(&s.invalidPasswordTotal, 1)
	}
}

func (s *OpsService) RecordHTTPRequest(path string, status int, duration time.Duration) {
	if strings.TrimSpace(path) == "/healthz" {
		return
	}
	if status < 100 {
		status = 200
	}
	atomic.AddInt64(&s.totalRequests, 1)
	switch {
	case status >= 200 && status < 300:
		atomic.AddInt64(&s.status2xxTotal, 1)
	case status >= 300 && status < 400:
		atomic.AddInt64(&s.status3xxTotal, 1)
	case status >= 400 && status < 500:
		atomic.AddInt64(&s.status4xxTotal, 1)
	case status >= 500:
		atomic.AddInt64(&s.status5xxTotal, 1)
	}
	now := time.Now().UTC()
	cutoff := now.Add(-10 * time.Minute)
	observation := httpObservation{at: now, status: status, durationMs: float64(duration) / float64(time.Millisecond)}
	s.httpMu.Lock()
	s.httpObservations = append(s.httpObservations, observation)
	trimmed := s.httpObservations[:0]
	for _, item := range s.httpObservations {
		if item.at.Before(cutoff) {
			continue
		}
		trimmed = append(trimmed, item)
	}
	if len(trimmed) > 4096 {
		trimmed = append([]httpObservation(nil), trimmed[len(trimmed)-4096:]...)
	} else {
		trimmed = append([]httpObservation(nil), trimmed...)
	}
	s.httpObservations = trimmed
	s.httpMu.Unlock()
}

func (s *OpsService) HealthSnapshot(ctx context.Context) OpsHealthSnapshot {
	health := OpsHealthSnapshot{
		Alive:     true,
		Ready:     true,
		Status:    "ok",
		Message:   "Core backend dependencies responded within the health probe window.",
		CheckedAt: time.Now().UTC(),
	}
	if s.userRepo == nil {
		return health
	}
	checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if _, err := s.userRepo.Count(checkCtx); err != nil {
		health.Ready = false
		health.Status = "critical"
		health.Message = fmt.Sprintf("Firebase health probe failed: %v", err)
	}
	return health
}

func (s *OpsService) Snapshot(ctx context.Context) (*OpsSnapshot, error) {
	s.cacheMu.Lock()
	if s.cached != nil && time.Since(s.cachedAt) < 3*time.Second {
		cached := s.cached
		s.cacheMu.Unlock()
		return cached, nil
	}
	s.cacheMu.Unlock()

	system := s.collectSystem()
	platform := OpsPlatformSnapshot{}
	health := s.HealthSnapshot(ctx)
	platformSnapshot, err := s.collectPlatform(ctx)
	if err != nil {
		health.Ready = false
		health.Status = "critical"
		health.Message = fmt.Sprintf("%s Platform telemetry degraded: %v", strings.TrimSpace(health.Message), err)
	} else {
		platform = platformSnapshot
	}
	judge := JudgeMetricsSnapshot{}
	if s.judgeSvc != nil {
		judge = s.judgeSvc.MetricsSnapshot()
	}
	httpSnapshot := s.collectHTTP()
	alerts := s.evaluateAlerts(system, judge, httpSnapshot, health)
	snapshot := &OpsSnapshot{
		GeneratedAt: time.Now().UTC(),
		System:      system,
		Platform:    platform,
		Judge:       judge,
		Security: OpsSecuritySnapshot{
			UnauthorizedTotal:    atomic.LoadInt64(&s.unauthorizedTotal),
			ForbiddenTotal:       atomic.LoadInt64(&s.forbiddenTotal),
			InvalidPasswordTotal: atomic.LoadInt64(&s.invalidPasswordTotal),
		},
		HTTP:   httpSnapshot,
		Health: health,
		Alerts: alerts,
	}

	s.cacheMu.Lock()
	s.cached = snapshot
	s.cachedAt = time.Now()
	s.cacheMu.Unlock()

	return snapshot, nil
}

func (s *OpsService) collectSystem() OpsSystemSnapshot {
	hostname, _ := os.Hostname()
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	systemCPU, processCPU := s.sampleCPUPercent()
	load1, load5, load15 := readPlatformLoadAverages()
	totalMem, usedMem := readPlatformSystemMemory()
	containerLimit, containerUsed := readPlatformContainerMemory()
	processRSS := readPlatformProcessRSS()
	if runtime.GOOS == "windows" && load1 == 0 && load5 == 0 && load15 == 0 && systemCPU > 0 {
		cpuLoad := float64(runtime.NumCPU()) * systemCPU / 100.0
		load1 = cpuLoad
		load5 = cpuLoad
		load15 = cpuLoad
	}
	containerPct := 0.0
	if containerLimit > 0 {
		containerPct = float64(containerUsed) / float64(containerLimit) * 100
	}
	systemPct := 0.0
	if totalMem > 0 {
		systemPct = float64(usedMem) / float64(totalMem) * 100
	}
	return OpsSystemSnapshot{
		Hostname:               hostname,
		OS:                     runtime.GOOS,
		Arch:                   runtime.GOARCH,
		GoVersion:              runtime.Version(),
		StartedAt:              s.startedAt,
		UptimeSec:              int64(time.Since(s.startedAt).Seconds()),
		CPUCores:               runtime.NumCPU(),
		SystemCPUPercent:       round2(systemCPU),
		ProcessCPUPercent:      round2(processCPU),
		Load1:                  round2(load1),
		Load5:                  round2(load5),
		Load15:                 round2(load15),
		SystemMemoryTotalMB:    bytesToMB(totalMem),
		SystemMemoryUsedMB:     bytesToMB(usedMem),
		SystemMemoryUsedPct:    round2(systemPct),
		ContainerMemoryLimitMB: bytesToMB(containerLimit),
		ContainerMemoryUsedMB:  bytesToMB(containerUsed),
		ContainerMemoryUsedPct: round2(containerPct),
		ProcessRSSMB:           bytesToMB(processRSS),
		GoAllocMB:              bytesToMB(memStats.Alloc),
		GoHeapSysMB:            bytesToMB(memStats.HeapSys),
		GoSysMB:                bytesToMB(memStats.Sys),
		Goroutines:             runtime.NumGoroutine(),
		GCCount:                memStats.NumGC,
	}
}

func (s *OpsService) collectPlatform(ctx context.Context) (OpsPlatformSnapshot, error) {
	result := OpsPlatformSnapshot{
		SubmissionsByLang:  map[string]int{},
		SolvedByDifficulty: map[string]int{"EASY": 0, "MEDIUM": 0, "HARD": 0, "UNKNOWN": 0},
	}
	users := []*domain.User{}
	if s.userRepo != nil {
		list, err := s.userRepo.List(ctx)
		if err != nil {
			return result, err
		}
		users = list
	}
	result.TotalUsers = len(users)
	now := time.Now().UTC()
	for _, user := range users {
		if user == nil {
			continue
		}
		if user.Role == domain.UserRoleAdmin {
			result.AdminUsers++
		}
		if !user.CreatedAt.IsZero() && now.Sub(user.CreatedAt) <= 24*time.Hour {
			result.NewUsers24h++
		}
	}

	problemDifficulty := map[string]string{}
	if s.problemSvc != nil {
		problems, err := s.problemSvc.ListAdmin(ctx)
		if err != nil {
			return result, err
		}
		result.TotalProblems = len(problems)
		for _, problem := range problems {
			if problem == nil {
				continue
			}
			problemDifficulty[problem.ID] = strings.ToUpper(strings.TrimSpace(string(problem.Difficulty)))
			switch problem.Status {
			case domain.ProblemStatusPublished:
				result.PublishedProblems++
			case domain.ProblemStatusDraft:
				result.DraftProblems++
			case domain.ProblemStatusArchived:
				result.ArchivedProblems++
			}
		}
	}

	daySubs := map[string]int{}
	daySolved := map[string]int{}
	passed := 0
	if s.practiceRepo != nil {
		for _, user := range users {
			if user == nil || strings.TrimSpace(user.ID) == "" {
				continue
			}
			solved, err := s.practiceRepo.ListSolved(ctx, user.ID)
			if err == nil {
				for pid, rec := range solved {
					result.SolvedEvents++
					difficulty := strings.ToUpper(strings.TrimSpace(problemDifficulty[pid]))
					if difficulty == "" {
						difficulty = "UNKNOWN"
					}
					result.SolvedByDifficulty[difficulty]++
					if !rec.SolvedAt.IsZero() {
						day := rec.SolvedAt.UTC().Format("2006-01-02")
						daySolved[day]++
						if now.Sub(rec.SolvedAt.UTC()) <= 24*time.Hour {
							result.Solved24h++
						}
					}
				}
			}
			submissions, err := s.practiceRepo.ListSubmissions(ctx, user.ID)
			if err == nil {
				for _, sub := range submissions {
					result.TotalSubmissions++
					if sub.Passed {
						passed++
					}
					lang := strings.ToUpper(strings.TrimSpace(sub.Language))
					if lang == "" {
						lang = "UNKNOWN"
					}
					result.SubmissionsByLang[lang]++
					if !sub.CreatedAt.IsZero() {
						day := sub.CreatedAt.UTC().Format("2006-01-02")
						daySubs[day]++
						if now.Sub(sub.CreatedAt.UTC()) <= 24*time.Hour {
							result.Submissions24h++
						}
					}
				}
			}
		}
	}
	result.PassedSubmissions = passed
	if result.TotalSubmissions > 0 {
		result.PassRatePct = round2(float64(passed) / float64(result.TotalSubmissions) * 100)
	}
	result.SubmissionsDaily = makeDailySeries(daySubs, 14)
	result.SolvedDaily = makeDailySeries(daySolved, 14)

	if s.roomSvc != nil {
		rooms, err := s.roomSvc.ListAll(ctx)
		if err != nil {
			return result, err
		}
		result.ActiveRooms = len(rooms)
		livePlayers := 0
		for _, room := range rooms {
			if room == nil {
				continue
			}
			if room.IsPrivate {
				result.PrivateRooms++
			}
			if room.Status == domain.RoomStatusWaiting {
				result.WaitingRooms++
			}
			if room.Status == domain.RoomStatusRunning {
				result.RunningRooms++
			}
			if room.Status == domain.RoomStatusRunning && strings.TrimSpace(room.ActiveGameID) != "" {
				result.RunningGames++
			}
			livePlayers += len(room.Members)
		}
		result.LivePlayers = livePlayers
	}

	return result, nil
}

func (s *OpsService) sampleCPUPercent() (float64, float64) {
	total, idle, proc, err := readPlatformCPUCounters()
	if err != nil {
		return 0, 0
	}
	s.cpuMu.Lock()
	defer s.cpuMu.Unlock()
	if !s.cpuPrev.valid {
		s.cpuPrev = cpuCounters{total: total, idle: idle, proc: proc, valid: true}
		return 0, 0
	}
	deltaTotal := total - s.cpuPrev.total
	deltaIdle := idle - s.cpuPrev.idle
	deltaProc := proc - s.cpuPrev.proc
	s.cpuPrev = cpuCounters{total: total, idle: idle, proc: proc, valid: true}
	if deltaTotal == 0 {
		return 0, 0
	}
	systemCPU := float64(deltaTotal-deltaIdle) / float64(deltaTotal) * 100
	processCPU := float64(deltaProc) / float64(deltaTotal) * float64(runtime.NumCPU()) * 100
	if processCPU < 0 {
		processCPU = 0
	}
	return systemCPU, processCPU
}

func (s *OpsService) collectHTTP() OpsHTTPSnapshot {
	now := time.Now().UTC()
	s.httpMu.Lock()
	observations := append([]httpObservation(nil), s.httpObservations...)
	s.httpMu.Unlock()
	return OpsHTTPSnapshot{
		TotalRequests:  atomic.LoadInt64(&s.totalRequests),
		Status2xxTotal: atomic.LoadInt64(&s.status2xxTotal),
		Status3xxTotal: atomic.LoadInt64(&s.status3xxTotal),
		Status4xxTotal: atomic.LoadInt64(&s.status4xxTotal),
		Status5xxTotal: atomic.LoadInt64(&s.status5xxTotal),
		Last30Sec:      makeHTTPWindow(observations, now.Add(-30*time.Second), 30),
		Last120Sec:     makeHTTPWindow(observations, now.Add(-120*time.Second), 120),
	}
}

func (s *OpsService) evaluateAlerts(system OpsSystemSnapshot, judge JudgeMetricsSnapshot, httpSnapshot OpsHTTPSnapshot, health OpsHealthSnapshot) []OpsAlert {
	alerts := make([]OpsAlert, 0, 8)
	memoryPressure := math.Max(system.ContainerMemoryUsedPct, system.SystemMemoryUsedPct)
	if !health.Ready {
		alerts = append(alerts, OpsAlert{ID: "backend-health-critical", Severity: "critical", Signal: "Errors", Title: "Backend health check is failing", Detail: health.Message, Note: "The admin dashboard can still render stale or partial telemetry while the platform dependency is degraded.", Runbook: "Runbook: hit /healthz directly, validate Firebase credentials and RTDB reachability, then roll only the failing backend tasks after connectivity is restored."})
	}
	if httpSnapshot.Last120Sec.TotalRequests >= 20 && httpSnapshot.Last120Sec.ServerErrorRatePct >= 5 {
		alerts = append(alerts, OpsAlert{ID: "http-5xx-critical", Severity: "critical", Signal: "Errors", Title: "5xx error rate is sustained above the critical SRE threshold", Detail: fmt.Sprintf("HTTP 5xx rate is %.1f%% across %d requests in the last %ds.", httpSnapshot.Last120Sec.ServerErrorRatePct, httpSnapshot.Last120Sec.TotalRequests, httpSnapshot.Last120Sec.WindowSec), Note: "This matches an active failure pattern rather than simple saturation.", Runbook: "Runbook: isolate the failing route family, inspect backend logs and dependency timeouts, then halt the rollout or drain unhealthy tasks until 5xx falls under 5%."})
	}
	if memoryPressure >= 90 {
		alerts = append(alerts, OpsAlert{ID: "memory-critical", Severity: "critical", Signal: "Saturation", Title: "Memory pressure is beyond the safe production headroom", Detail: fmt.Sprintf("Memory pressure is %.1f%%, which leaves almost no room before worker recycling or OOM behavior.", memoryPressure), Note: "Critical memory pressure tends to cascade into slower judge execution and API instability.", Runbook: "Runbook: inspect RSS versus Go heap, reduce hot traffic, and replace only the most memory-heavy replica if pressure does not fall."})
	} else if memoryPressure >= 75 {
		alerts = append(alerts, OpsAlert{ID: "memory-warning", Severity: "warning", Signal: "Saturation", Title: "Memory pressure is elevated", Detail: fmt.Sprintf("Memory usage is %.1f%%, above the warning threshold for steady-state operation.", memoryPressure), Note: "This is still serviceable but should be watched before the cluster loses headroom.", Runbook: "Runbook: compare container usage, process RSS, and judge concurrency, then defer noisy jobs or scale out before memory crosses 90%."})
	}
	if system.SystemCPUPercent >= 75 || system.Load1 >= math.Max(1, float64(system.CPUCores))*0.8 {
		alerts = append(alerts, OpsAlert{ID: "cpu-warning", Severity: "warning", Signal: "Saturation", Title: "CPU saturation is approaching production limits", Detail: fmt.Sprintf("System CPU is %.1f%% with load1 at %.2f across %d cores.", system.SystemCPUPercent, system.Load1, system.CPUCores), Note: "Sustained CPU pressure usually shows up first as latency growth for judge and API responses.", Runbook: "Runbook: inspect active sandboxes, request rate, and background tasks, then rebalance traffic or scale backend replicas before user-facing latency jumps."})
	}
	if judge.Enabled && math.Max(judge.JudgeP95Ms, judge.CompileP95Ms) >= 800 {
		alerts = append(alerts, OpsAlert{ID: "judge-latency-warning", Severity: "warning", Signal: "Latency", Title: "Judge latency is above the operator warning threshold", Detail: fmt.Sprintf("Compile p95 is %.0f ms and judge p95 is %.0f ms.", judge.CompileP95Ms, judge.JudgeP95Ms), Note: "Latency is high but the system is still operating; this is the point to intervene before contestants feel outright failure.", Runbook: "Runbook: inspect compile-heavy submissions, sandbox concurrency, and CPU pressure, then scale judge workers or throttle noisy load."})
	}
	if httpSnapshot.Last30Sec.TotalRequests >= 10 && httpSnapshot.Last30Sec.ClientErrorRatePct >= 20 {
		alerts = append(alerts, OpsAlert{ID: "http-4xx-warning", Severity: "warning", Signal: "Errors", Title: "Client-side error rate spiked in the latest traffic window", Detail: fmt.Sprintf("HTTP 4xx rate is %.1f%% across %d requests in the last %ds.", httpSnapshot.Last30Sec.ClientErrorRatePct, httpSnapshot.Last30Sec.TotalRequests, httpSnapshot.Last30Sec.WindowSec), Note: "This often indicates auth drift, stale frontend assumptions, or abusive user input rather than backend failure.", Runbook: "Runbook: inspect 401/403/404 trends, confirm the frontend API base and auth freshness, and correlate with recent admin or room actions."})
	}
	if httpSnapshot.Last30Sec.TotalRequests >= 10 && httpSnapshot.Last30Sec.RedirectRatePct >= 10 {
		alerts = append(alerts, OpsAlert{ID: "http-3xx-warning", Severity: "warning", Signal: "Traffic", Title: "Redirect churn is higher than expected", Detail: fmt.Sprintf("HTTP 3xx rate is %.1f%% across %d requests in the last %ds.", httpSnapshot.Last30Sec.RedirectRatePct, httpSnapshot.Last30Sec.TotalRequests, httpSnapshot.Last30Sec.WindowSec), Note: "A redirect spike can point to routing drift, unexpected canonicalization loops, or clients bouncing between entrypoints.", Runbook: "Runbook: inspect proxy rules, canonical URLs, and frontend routing so redirect loops do not waste request budget."})
	}
	if httpSnapshot.Last30Sec.TotalRequests >= 10 && httpSnapshot.Last30Sec.LatencyP95Ms >= 1000 {
		alerts = append(alerts, OpsAlert{ID: "http-latency-warning", Severity: "warning", Signal: "Latency", Title: "API latency crossed the warning band", Detail: fmt.Sprintf("HTTP latency p95 is %.0f ms in the last %ds window.", httpSnapshot.Last30Sec.LatencyP95Ms, httpSnapshot.Last30Sec.WindowSec), Note: "This is the Golden Signals latency view for the API layer itself, separate from judge latency.", Runbook: "Runbook: inspect recent request volume, saturation, and backend dependencies, then compare API latency with judge and Firebase health before rolling changes."})
	}
	return alerts
}

func makeHTTPWindow(observations []httpObservation, since time.Time, windowSec int) OpsHTTPWindowSnapshot {
	window := OpsHTTPWindowSnapshot{WindowSec: windowSec}
	latencies := make([]float64, 0, len(observations))
	for _, observation := range observations {
		if observation.at.Before(since) {
			continue
		}
		window.TotalRequests++
		latencies = append(latencies, observation.durationMs)
		switch {
		case observation.status >= 200 && observation.status < 300:
			window.Status2xx++
		case observation.status >= 300 && observation.status < 400:
			window.Status3xx++
		case observation.status >= 400 && observation.status < 500:
			window.Status4xx++
		case observation.status >= 500:
			window.Status5xx++
		}
	}
	if window.TotalRequests > 0 {
		window.RequestRatePerMin = round2(float64(window.TotalRequests) / float64(windowSec) * 60)
		window.RedirectRatePct = round2(float64(window.Status3xx) / float64(window.TotalRequests) * 100)
		window.ClientErrorRatePct = round2(float64(window.Status4xx) / float64(window.TotalRequests) * 100)
		window.ServerErrorRatePct = round2(float64(window.Status5xx) / float64(window.TotalRequests) * 100)
	}
	window.LatencyAvgMs = round2(averageFloat64(latencies))
	window.LatencyP95Ms = round2(computePercentile(latencies, 0.95))
	return window
}

func makeDailySeries(items map[string]int, days int) []OpsDailyCount {
	now := time.Now().UTC()
	out := make([]OpsDailyCount, 0, days)
	for i := days - 1; i >= 0; i-- {
		day := now.AddDate(0, 0, -i).Format("2006-01-02")
		out = append(out, OpsDailyCount{Day: day, Count: items[day]})
	}
	return out
}

func bytesToMB(value uint64) float64 {
	if value == 0 {
		return 0
	}
	return round2(float64(value) / 1024.0 / 1024.0)
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func averageFloat64(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	total := 0.0
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}

func readProcCPUCounters() (uint64, uint64, uint64, error) {
	systemRaw, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0, 0, err
	}
	lines := strings.Split(string(systemRaw), "\n")
	if len(lines) == 0 {
		return 0, 0, 0, fmt.Errorf("empty /proc/stat")
	}
	cpuFields := strings.Fields(lines[0])
	if len(cpuFields) < 5 || cpuFields[0] != "cpu" {
		return 0, 0, 0, fmt.Errorf("invalid /proc/stat")
	}
	var total uint64
	for _, field := range cpuFields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return 0, 0, 0, err
		}
		total += value
	}
	idle, _ := strconv.ParseUint(cpuFields[4], 10, 64)
	if len(cpuFields) > 5 {
		ioWait, _ := strconv.ParseUint(cpuFields[5], 10, 64)
		idle += ioWait
	}
	procRaw, err := os.ReadFile("/proc/self/stat")
	if err != nil {
		return 0, 0, 0, err
	}
	statLine := string(procRaw)
	end := strings.LastIndex(statLine, ")")
	if end == -1 || end+2 >= len(statLine) {
		return 0, 0, 0, fmt.Errorf("invalid /proc/self/stat")
	}
	fields := strings.Fields(statLine[end+2:])
	if len(fields) < 15 {
		return 0, 0, 0, fmt.Errorf("short /proc/self/stat")
	}
	utime, err := strconv.ParseUint(fields[11], 10, 64)
	if err != nil {
		return 0, 0, 0, err
	}
	stime, err := strconv.ParseUint(fields[12], 10, 64)
	if err != nil {
		return 0, 0, 0, err
	}
	return total, idle, utime + stime, nil
}

func readLoadAverages() (float64, float64, float64) {
	raw, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0
	}
	fields := strings.Fields(string(raw))
	if len(fields) < 3 {
		return 0, 0, 0
	}
	load1, _ := strconv.ParseFloat(fields[0], 64)
	load5, _ := strconv.ParseFloat(fields[1], 64)
	load15, _ := strconv.ParseFloat(fields[2], 64)
	return load1, load5, load15
}

func readSystemMemory() (uint64, uint64) {
	raw, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	var totalKB uint64
	var availableKB uint64
	for _, line := range strings.Split(string(raw), "\n") {
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		switch strings.TrimSuffix(parts[0], ":") {
		case "MemTotal":
			totalKB, _ = strconv.ParseUint(parts[1], 10, 64)
		case "MemAvailable":
			availableKB, _ = strconv.ParseUint(parts[1], 10, 64)
		}
	}
	if totalKB == 0 {
		return 0, 0
	}
	usedKB := totalKB
	if availableKB <= totalKB {
		usedKB = totalKB - availableKB
	}
	return totalKB * 1024, usedKB * 1024
}

func readProcessRSS() uint64 {
	raw, err := os.ReadFile("/proc/self/status")
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(raw), "\n") {
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		if strings.TrimSuffix(parts[0], ":") != "VmRSS" {
			continue
		}
		value, err := strconv.ParseUint(parts[1], 10, 64)
		if err != nil {
			return 0
		}
		return value * 1024
	}
	return 0
}

func readContainerMemory() (uint64, uint64) {
	used := readUintFileFirst([]string{"/sys/fs/cgroup/memory.current", "/sys/fs/cgroup/memory/memory.usage_in_bytes"})
	limit := readUintFileFirst([]string{"/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"})
	if limit == 0 || limit > 1<<60 {
		return 0, used
	}
	return limit, used
}

func readUintFileFirst(paths []string) uint64 {
	for _, path := range paths {
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		value := strings.TrimSpace(string(raw))
		if value == "" || value == "max" {
			continue
		}
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err == nil {
			return parsed
		}
	}
	return 0
}

func computePercentile(values []float64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}
	copyValues := append([]float64(nil), values...)
	sort.Float64s(copyValues)
	if percentile <= 0 {
		return copyValues[0]
	}
	if percentile >= 1 {
		return copyValues[len(copyValues)-1]
	}
	index := int(math.Ceil(percentile*float64(len(copyValues)))) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(copyValues) {
		index = len(copyValues) - 1
	}
	return copyValues[index]
}
