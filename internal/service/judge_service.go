package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"
)

type JudgeLanguage string

const (
	JudgeLanguageGo     JudgeLanguage = "go"
	JudgeLanguagePython JudgeLanguage = "py"
)

type TestcaseResult struct {
	Index   int    `json:"index"`
	Passed  bool   `json:"passed"`
	Hidden  bool   `json:"hidden"`
	Runtime int    `json:"runtimeMs"`
	Error   string `json:"error,omitempty"`
	Output  string `json:"output,omitempty"`
}

type JudgeResult struct {
	ProblemID string           `json:"problemId"`
	Language  JudgeLanguage    `json:"language"`
	Passed    bool             `json:"passed"`
	PassedCnt int              `json:"passedCount"`
	TotalCnt  int              `json:"totalCount"`
	Results   []TestcaseResult `json:"results"`
}

type JudgeMetricsSnapshot struct {
	Enabled           bool      `json:"enabled"`
	ActiveSandboxes   int64     `json:"activeSandboxes"`
	TotalRuns         int64     `json:"totalRuns"`
	SuccessfulRuns    int64     `json:"successfulRuns"`
	FailedRuns        int64     `json:"failedRuns"`
	SuccessRatePct    float64   `json:"successRatePct"`
	CompileErrors     int64     `json:"compileErrors"`
	RuntimeErrors     int64     `json:"runtimeErrors"`
	TimeLimitExceeded int64     `json:"timeLimitExceeded"`
	CompileAvgMs      float64   `json:"compileAvgMs"`
	CompileP95Ms      float64   `json:"compileP95Ms"`
	JudgeAvgMs        float64   `json:"judgeAvgMs"`
	JudgeP95Ms        float64   `json:"judgeP95Ms"`
	LastDurationMs    float64   `json:"lastDurationMs"`
	LastCompileMs     float64   `json:"lastCompileMs"`
	LastResultAt      time.Time `json:"lastResultAt"`
}

type JudgeService struct {
	problems   *ProblemService
	devMode    bool
	metrics    judgeMetrics
	goCacheDir string
}

type judgeMetrics struct {
	activeSandboxes   int64
	totalRuns         int64
	successfulRuns    int64
	failedRuns        int64
	compileErrors     int64
	runtimeErrors     int64
	timeLimitExceeded int64
	lastDurationNs    int64
	lastCompileNs     int64
	lastResultAtNs    int64
	mu                sync.Mutex
	compileSamples    []float64
	judgeSamples      []float64
}

func NewJudgeService(problems *ProblemService) *JudgeService {
	dev := strings.EqualFold(strings.TrimSpace(os.Getenv("JUDGE_DEV")), "1") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("JUDGE_DEV")), "true")

	cacheDir, _ := os.MkdirTemp("", "judgo-gocache-*")
	if cacheDir == "" {
		cacheDir = filepath.Join(os.TempDir(), "judgo-gocache")
		_ = os.MkdirAll(cacheDir, 0755)
	}

	svc := &JudgeService{problems: problems, devMode: dev, goCacheDir: cacheDir}
	if dev {
		go svc.warmGoCache()
	}
	return svc
}

func (s *JudgeService) warmGoCache() {
	dir, err := os.MkdirTemp("", "judgo-warmup-*")
	if err != nil {
		return
	}
	defer os.RemoveAll(dir)

	_ = os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module warmup\ngo 1.21\n"), 0644)
	_ = os.WriteFile(filepath.Join(dir, "main.go"), []byte("package main\nimport \"fmt\"\nfunc main(){fmt.Println(0)}\n"), 0644)

	binName := "warmup"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "go", "build", "-o", binName, "main.go")
	cmd.Dir = dir
	cmd.Env = s.goBuildEnv()
	_ = cmd.Run()
}

func normalizeOutput(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.TrimRightFunc(s, unicode.IsSpace)
}

func (s *JudgeService) MetricsSnapshot() JudgeMetricsSnapshot {
	totalRuns := atomic.LoadInt64(&s.metrics.totalRuns)
	successfulRuns := atomic.LoadInt64(&s.metrics.successfulRuns)
	failedRuns := atomic.LoadInt64(&s.metrics.failedRuns)
	compileErrors := atomic.LoadInt64(&s.metrics.compileErrors)
	runtimeErrors := atomic.LoadInt64(&s.metrics.runtimeErrors)
	timeLimitExceeded := atomic.LoadInt64(&s.metrics.timeLimitExceeded)
	lastDurationMs := float64(atomic.LoadInt64(&s.metrics.lastDurationNs)) / float64(time.Millisecond)
	lastCompileMs := float64(atomic.LoadInt64(&s.metrics.lastCompileNs)) / float64(time.Millisecond)
	lastResultAtNs := atomic.LoadInt64(&s.metrics.lastResultAtNs)
	lastResultAt := time.Time{}
	if lastResultAtNs > 0 {
		lastResultAt = time.Unix(0, lastResultAtNs).UTC()
	}
	s.metrics.mu.Lock()
	compileSamples := append([]float64(nil), s.metrics.compileSamples...)
	judgeSamples := append([]float64(nil), s.metrics.judgeSamples...)
	s.metrics.mu.Unlock()
	successRate := 0.0
	if totalRuns > 0 {
		successRate = float64(successfulRuns) / float64(totalRuns) * 100
	}
	return JudgeMetricsSnapshot{
		Enabled:           s.devMode,
		ActiveSandboxes:   atomic.LoadInt64(&s.metrics.activeSandboxes),
		TotalRuns:         totalRuns,
		SuccessfulRuns:    successfulRuns,
		FailedRuns:        failedRuns,
		SuccessRatePct:    round2(successRate),
		CompileErrors:     compileErrors,
		RuntimeErrors:     runtimeErrors,
		TimeLimitExceeded: timeLimitExceeded,
		CompileAvgMs:      round2(averageFloat64(compileSamples)),
		CompileP95Ms:      round2(computePercentile(compileSamples, 0.95)),
		JudgeAvgMs:        round2(averageFloat64(judgeSamples)),
		JudgeP95Ms:        round2(computePercentile(judgeSamples, 0.95)),
		LastDurationMs:    round2(lastDurationMs),
		LastCompileMs:     round2(lastCompileMs),
		LastResultAt:      lastResultAt,
	}
}

func (s *JudgeService) Judge(ctx context.Context, problemID string, lang JudgeLanguage, code string, timeout time.Duration) (*JudgeResult, error) {
	if !s.devMode {
		return nil, fmt.Errorf("judge is disabled (set JUDGE_DEV=1)")
	}
	problemID = strings.TrimSpace(problemID)
	if problemID == "" {
		return nil, fmt.Errorf("problemId is required")
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, fmt.Errorf("code is required")
	}
	if timeout <= 0 {
		timeout = 2 * time.Second
	}

	p, err := s.problems.GetAdmin(ctx, problemID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("problem not found")
	}
	if len(p.TestCases) == 0 {
		return nil, fmt.Errorf("problem has no testCases")
	}

	judgeStartedAt := time.Now()

	workDir, err := os.MkdirTemp("", "judgo-judge-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	atomic.AddInt64(&s.metrics.activeSandboxes, 1)
	atomic.AddInt64(&s.metrics.totalRuns, 1)
	defer atomic.AddInt64(&s.metrics.activeSandboxes, -1)
	defer os.RemoveAll(workDir)

	switch lang {
	case JudgeLanguageGo:
		if err := os.WriteFile(filepath.Join(workDir, "main.go"), []byte(code), 0644); err != nil {
			return nil, fmt.Errorf("failed to write main.go: %w", err)
		}
	case JudgeLanguagePython:
		if err := os.WriteFile(filepath.Join(workDir, "main.py"), []byte(code), 0644); err != nil {
			return nil, fmt.Errorf("failed to write main.py: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported language: %s", lang)
	}

	goBin, compileDuration, err := s.buildGoBinary(ctx, workDir, lang, timeout)
	if err != nil {
		s.observeJudgeFailure(err, time.Since(judgeStartedAt), compileDuration)
		return nil, err
	}

	res := &JudgeResult{
		ProblemID: problemID,
		Language:  lang,
		Passed:    true,
		TotalCnt:  len(p.TestCases),
		Results:   make([]TestcaseResult, 0, len(p.TestCases)),
	}

	hadRuntimeError := false
	hadTimeLimitExceeded := false
	for i, tc := range p.TestCases {
		start := time.Now()
		out, runErr := s.runOnce(ctx, workDir, lang, goBin, tc.Input, timeout)
		runtimeMs := int(time.Since(start).Milliseconds())

		nOut := normalizeOutput(out)
		nExp := normalizeOutput(tc.Output)

		passed := runErr == nil && nOut == nExp
		tr := TestcaseResult{
			Index:   i,
			Passed:  passed,
			Hidden:  tc.IsHidden,
			Runtime: runtimeMs,
		}
		if runErr != nil {
			tr.Error = runErr.Error()
			if strings.Contains(strings.ToLower(runErr.Error()), "time limit exceeded") {
				hadTimeLimitExceeded = true
			} else {
				hadRuntimeError = true
			}
		}
		if !tc.IsHidden {
			tr.Output = nOut
		}

		res.Results = append(res.Results, tr)
		if passed {
			res.PassedCnt++
		} else {
			res.Passed = false
		}
	}

	s.observeJudgeCompletion(res.Passed, time.Since(judgeStartedAt), compileDuration, hadRuntimeError, hadTimeLimitExceeded)

	return res, nil
}

func (s *JudgeService) goBuildEnv() []string {
	env := os.Environ()
	env = append(env, "GOCACHE="+s.goCacheDir)
	env = append(env, "GOFLAGS=-trimpath")
	return env
}

func (s *JudgeService) buildGoBinary(ctx context.Context, workDir string, lang JudgeLanguage, timeout time.Duration) (string, time.Duration, error) {
	startedAt := time.Now()
	if lang != JudgeLanguageGo {
		return "", 0, nil
	}
	// go run per testcase is too slow on Windows; compile once then execute.
	binName := "main_bin"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	binPath := filepath.Join(workDir, binName)

	// write go.mod so the toolchain skips module discovery
	_ = os.WriteFile(filepath.Join(workDir, "go.mod"), []byte("module submission\ngo 1.21\n"), 0644)

	buildTimeout := 30 * time.Second
	if timeout > 0 {
		// give build more room than per-testcase timeout
		buildTimeout = timeout * 5
		if buildTimeout < 30*time.Second {
			buildTimeout = 30 * time.Second
		}
	}

	bctx, cancel := context.WithTimeout(ctx, buildTimeout)
	defer cancel()

	cmd := exec.CommandContext(bctx, "go", "build", "-o", binName, "main.go")
	cmd.Dir = workDir
	cmd.Env = s.goBuildEnv()
	out, err := cmd.CombinedOutput()
	if err != nil {
		if bctx.Err() == context.DeadlineExceeded {
			return "", time.Since(startedAt), fmt.Errorf("compile time limit exceeded")
		}
		errMsg := strings.TrimSpace(string(out))
		if errMsg == "" {
			errMsg = err.Error()
		}
		return "", time.Since(startedAt), fmt.Errorf("compile error: %s", errMsg)
	}

	return binPath, time.Since(startedAt), nil
}

func (s *JudgeService) observeJudgeFailure(err error, duration time.Duration, compileDuration time.Duration) {
	atomic.AddInt64(&s.metrics.failedRuns, 1)
	lower := strings.ToLower(strings.TrimSpace(err.Error()))
	if strings.Contains(lower, "compile") {
		atomic.AddInt64(&s.metrics.compileErrors, 1)
	}
	if strings.Contains(lower, "runtime error") {
		atomic.AddInt64(&s.metrics.runtimeErrors, 1)
	}
	if strings.Contains(lower, "time limit exceeded") {
		atomic.AddInt64(&s.metrics.timeLimitExceeded, 1)
	}
	s.observeJudgeDurations(duration, compileDuration)
}

func (s *JudgeService) observeJudgeCompletion(passed bool, duration time.Duration, compileDuration time.Duration, hadRuntimeError bool, hadTimeLimitExceeded bool) {
	if passed {
		atomic.AddInt64(&s.metrics.successfulRuns, 1)
	} else {
		atomic.AddInt64(&s.metrics.failedRuns, 1)
	}
	if hadRuntimeError {
		atomic.AddInt64(&s.metrics.runtimeErrors, 1)
	}
	if hadTimeLimitExceeded {
		atomic.AddInt64(&s.metrics.timeLimitExceeded, 1)
	}
	s.observeJudgeDurations(duration, compileDuration)
}

func (s *JudgeService) observeJudgeDurations(duration time.Duration, compileDuration time.Duration) {
	atomic.StoreInt64(&s.metrics.lastDurationNs, duration.Nanoseconds())
	atomic.StoreInt64(&s.metrics.lastCompileNs, compileDuration.Nanoseconds())
	atomic.StoreInt64(&s.metrics.lastResultAtNs, time.Now().UTC().UnixNano())
	s.metrics.mu.Lock()
	if compileDuration > 0 {
		s.metrics.compileSamples = appendWindowedSample(s.metrics.compileSamples, float64(compileDuration)/float64(time.Millisecond), 120)
	}
	s.metrics.judgeSamples = appendWindowedSample(s.metrics.judgeSamples, float64(duration)/float64(time.Millisecond), 120)
	s.metrics.mu.Unlock()
}

func appendWindowedSample(samples []float64, value float64, limit int) []float64 {
	samples = append(samples, value)
	if len(samples) <= limit {
		return samples
	}
	return append([]float64(nil), samples[len(samples)-limit:]...)
}

func (s *JudgeService) runOnce(ctx context.Context, workDir string, lang JudgeLanguage, goBin string, stdin string, timeout time.Duration) (string, error) {
	tctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var cmd *exec.Cmd
	switch lang {
	case JudgeLanguageGo:
		if strings.TrimSpace(goBin) == "" {
			return "", fmt.Errorf("internal error: go binary not built")
		}
		cmd = exec.CommandContext(tctx, goBin)
	case JudgeLanguagePython:
		py := "python"
		if runtime.GOOS != "windows" {
			// some linux environments require python3
			py = "python3"
		}
		cmd = exec.CommandContext(tctx, py, "main.py")
	default:
		return "", fmt.Errorf("unsupported language: %s", lang)
	}

	cmd.Dir = workDir
	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		return "", fmt.Errorf("failed to get stdin pipe: %w", err)
	}
	go func() {
		defer stdinPipe.Close()
		_, _ = io.WriteString(stdinPipe, stdin)
	}()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if tctx.Err() == context.DeadlineExceeded {
			return stdout.String(), fmt.Errorf("time limit exceeded")
		}
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = err.Error()
		}
		return stdout.String(), fmt.Errorf("runtime error: %s", errMsg)
	}

	return stdout.String(), nil
}
