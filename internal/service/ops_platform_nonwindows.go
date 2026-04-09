//go:build !windows

package service

func readPlatformCPUCounters() (uint64, uint64, uint64, error) {
	return readProcCPUCounters()
}

func readPlatformLoadAverages() (float64, float64, float64) {
	return readLoadAverages()
}

func readPlatformSystemMemory() (uint64, uint64) {
	return readSystemMemory()
}

func readPlatformContainerMemory() (uint64, uint64) {
	return readContainerMemory()
}

func readPlatformProcessRSS() uint64 {
	return readProcessRSS()
}
