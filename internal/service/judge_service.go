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

type JudgeService struct {
	problems *ProblemService
	devMode  bool
}

func NewJudgeService(problems *ProblemService) *JudgeService {
	dev := strings.EqualFold(strings.TrimSpace(os.Getenv("JUDGE_DEV")), "1") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("JUDGE_DEV")), "true")
	return &JudgeService{problems: problems, devMode: dev}
}

func normalizeOutput(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.TrimRightFunc(s, unicode.IsSpace)
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

	workDir, err := os.MkdirTemp("", "judgo-judge-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
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

	goBin, err := s.buildGoBinary(ctx, workDir, lang, timeout)
	if err != nil {
		return nil, err
	}

	res := &JudgeResult{
		ProblemID: problemID,
		Language:  lang,
		Passed:    true,
		TotalCnt:  len(p.TestCases),
		Results:   make([]TestcaseResult, 0, len(p.TestCases)),
	}

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

	return res, nil
}

func (s *JudgeService) buildGoBinary(ctx context.Context, workDir string, lang JudgeLanguage, timeout time.Duration) (string, error) {
	if lang != JudgeLanguageGo {
		return "", nil
	}
	// go run per testcase is too slow on Windows; compile once then execute.
	binName := "main_bin"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	binPath := filepath.Join(workDir, binName)

	buildTimeout := 10 * time.Second
	if timeout > 0 {
		// give build more room than per-testcase timeout
		buildTimeout = timeout * 5
		if buildTimeout < 10*time.Second {
			buildTimeout = 10 * time.Second
		}
	}

	bctx, cancel := context.WithTimeout(ctx, buildTimeout)
	defer cancel()

	cmd := exec.CommandContext(bctx, "go", "build", "-o", binName, "main.go")
	cmd.Dir = workDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		if bctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("compile time limit exceeded")
		}
		errMsg := strings.TrimSpace(string(out))
		if errMsg == "" {
			errMsg = err.Error()
		}
		return "", fmt.Errorf("compile error: %s", errMsg)
	}

	return binPath, nil
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
