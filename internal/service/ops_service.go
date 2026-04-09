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

type OpsSnapshot struct {
	GeneratedAt time.Time            `json:"generatedAt"`
	System      OpsSystemSnapshot    `json:"system"`
	Platform    OpsPlatformSnapshot  `json:"platform"`
	Judge       JudgeMetricsSnapshot `json:"judge"`
	Security    OpsSecuritySnapshot  `json:"security"`
}

type cpuCounters struct {
	total uint64
	idle  uint64
	proc  uint64
	valid bool
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

func (s *OpsService) Snapshot(ctx context.Context) (*OpsSnapshot, error) {
	s.cacheMu.Lock()
	if s.cached != nil && time.Since(s.cachedAt) < 3*time.Second {
		cached := s.cached
		s.cacheMu.Unlock()
		return cached, nil
	}
	s.cacheMu.Unlock()

	system := s.collectSystem()
	platform, err := s.collectPlatform(ctx)
	if err != nil {
		return nil, err
	}
	judge := JudgeMetricsSnapshot{}
	if s.judgeSvc != nil {
		judge = s.judgeSvc.MetricsSnapshot()
	}
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
