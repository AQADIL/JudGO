package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os/exec"
)

type Result struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

func Run(ctx context.Context, cmd *exec.Cmd, input string) (*Result, error) {
	if cmd == nil {
		return nil, fmt.Errorf("cmd is nil")
	}
	if ctx != nil {
		path := cmd.Path
		args := append([]string{}, cmd.Args...)
		dir := cmd.Dir
		env := append([]string{}, cmd.Env...)

		cmd = exec.CommandContext(ctx, path, args[1:]...)
		cmd.Dir = dir
		cmd.Env = env
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	go func() {
		defer stdin.Close()
		_, _ = io.WriteString(stdin, input)
	}()

	err = cmd.Run()
	exitCode := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exitCode = ee.ExitCode()
		} else {
			exitCode = -1
		}
	}

	res := &Result{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
	}
	return res, err
}
