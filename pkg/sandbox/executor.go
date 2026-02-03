package sandbox

import (
	"math/rand"
	"time"
)

var (
	mockStatuses = []string{"Accepted", "Wrong Answer"}
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// RunMock simulates running user code in a sandbox.
// It blocks for ~1s and then returns a pseudo-random verdict and score.
func RunMock(code string) (status string, score int) {
	_ = code // we do not analyze the code in the mock implementation

	time.Sleep(time.Second)

	status = mockStatuses[rand.Intn(len(mockStatuses))]
	if status == "Accepted" {
		score = 100
	} else {
		score = rand.Intn(50) // some non-zero score for experimentation
	}
	return
}
