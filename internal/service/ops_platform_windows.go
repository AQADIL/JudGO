//go:build windows

package service

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	kernel32DLL              = windows.NewLazySystemDLL("kernel32.dll")
	psapiDLL                 = windows.NewLazySystemDLL("psapi.dll")
	procGetSystemTimes       = kernel32DLL.NewProc("GetSystemTimes")
	procGetProcessTimes      = kernel32DLL.NewProc("GetProcessTimes")
	procGlobalMemoryStatusEx = kernel32DLL.NewProc("GlobalMemoryStatusEx")
	procGetProcessMemoryInfo = psapiDLL.NewProc("GetProcessMemoryInfo")
)

type windowsMemoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

type windowsProcessMemoryCounters struct {
	Cb                         uint32
	PageFaultCount             uint32
	PeakWorkingSetSize         uintptr
	WorkingSetSize             uintptr
	QuotaPeakPagedPoolUsage    uintptr
	QuotaPagedPoolUsage        uintptr
	QuotaPeakNonPagedPoolUsage uintptr
	QuotaNonPagedPoolUsage     uintptr
	PagefileUsage              uintptr
	PeakPagefileUsage          uintptr
}

func readPlatformCPUCounters() (uint64, uint64, uint64, error) {
	var idleTime windows.Filetime
	var kernelTime windows.Filetime
	var userTime windows.Filetime
	ret, _, _ := procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idleTime)),
		uintptr(unsafe.Pointer(&kernelTime)),
		uintptr(unsafe.Pointer(&userTime)),
	)
	if ret == 0 {
		return 0, 0, 0, fmt.Errorf("GetSystemTimes failed")
	}

	var creationTime windows.Filetime
	var exitTime windows.Filetime
	var procKernelTime windows.Filetime
	var procUserTime windows.Filetime
	currentProcess := windows.Handle(^uintptr(0))
	ret, _, _ = procGetProcessTimes.Call(
		uintptr(currentProcess),
		uintptr(unsafe.Pointer(&creationTime)),
		uintptr(unsafe.Pointer(&exitTime)),
		uintptr(unsafe.Pointer(&procKernelTime)),
		uintptr(unsafe.Pointer(&procUserTime)),
	)
	if ret == 0 {
		return 0, 0, 0, fmt.Errorf("GetProcessTimes failed")
	}

	total := filetimeToUint64(kernelTime) + filetimeToUint64(userTime)
	idle := filetimeToUint64(idleTime)
	proc := filetimeToUint64(procKernelTime) + filetimeToUint64(procUserTime)
	return total, idle, proc, nil
}

func readPlatformLoadAverages() (float64, float64, float64) {
	return 0, 0, 0
}

func readPlatformSystemMemory() (uint64, uint64) {
	state := windowsMemoryStatusEx{Length: uint32(unsafe.Sizeof(windowsMemoryStatusEx{}))}
	ret, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&state)))
	if ret == 0 || state.TotalPhys == 0 {
		return 0, 0
	}
	used := state.TotalPhys - state.AvailPhys
	return state.TotalPhys, used
}

func readPlatformContainerMemory() (uint64, uint64) {
	return 0, 0
}

func readPlatformProcessRSS() uint64 {
	counters := windowsProcessMemoryCounters{Cb: uint32(unsafe.Sizeof(windowsProcessMemoryCounters{}))}
	currentProcess := windows.Handle(^uintptr(0))
	ret, _, _ := procGetProcessMemoryInfo.Call(
		uintptr(currentProcess),
		uintptr(unsafe.Pointer(&counters)),
		uintptr(counters.Cb),
	)
	if ret == 0 {
		return 0
	}
	return uint64(counters.WorkingSetSize)
}

func filetimeToUint64(value windows.Filetime) uint64 {
	return uint64(value.HighDateTime)<<32 | uint64(value.LowDateTime)
}
