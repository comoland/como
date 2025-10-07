package node

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/user"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"time"
	"unsafe"

	"github.com/comoland/como/js"
	"golang.org/x/sys/unix"
)

var processStart = time.Now()

func goOS(ctx *js.Context, _ js.Value) {
	mod := ctx.NewModule("os.go")

	// endianness as 'LE' or 'BE'
	mod.Export("endianness", func(args js.Arguments) interface{} {
		var i uint32 = 0x01020304
		b := (*[4]byte)(unsafe.Pointer(&i))
		if b[0] == 0x04 {
			return "LE"
		}
		return "BE"
	})

	// platform / type / arch
	mod.Export("platform", func(args js.Arguments) interface{} {
		return runtime.GOOS
	})

	mod.Export("type", func(args js.Arguments) interface{} {
		switch runtime.GOOS {
		case "linux":
			return "Linux"
		case "darwin":
			return "Darwin"
		case "windows":
			return "Windows_NT"
		default:
			return runtime.GOOS
		}
	})

	mod.Export("arch", func(args js.Arguments) interface{} {
		return runtime.GOARCH
	})

	// homedir / getHomeDirectory
	homedirFn := func(args js.Arguments) interface{} {
		d, err := os.UserHomeDir()
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return d
	}
	mod.Export("homedir", homedirFn)
	mod.Export("getHomeDirectory", homedirFn)

	// tmpdir
	mod.Export("tmpdir", func(args js.Arguments) interface{} {
		return os.TempDir()
	})

	// hostname / getHostname
	mod.Export("hostname", func(args js.Arguments) interface{} {
		h, err := os.Hostname()
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return h
	})

	// export const devNull = isWindows ? "\\\\.\\nul" : "/dev/null";
	mod.Export("devNull", func(args js.Arguments) interface{} {
		return os.DevNull
	})

	// process uptime (seconds)
	mod.Export("uptime", func(args js.Arguments) interface{} {
		return time.Since(processStart).Seconds()
	})

	// system uptime (try /proc/uptime on linux)
	mod.Export("getUptime", func(args js.Arguments) interface{} {
		if runtime.GOOS == "linux" {
			f, err := os.Open("/proc/uptime")
			if err != nil {
				return ctx.Throw(err.Error())
			}
			defer f.Close()
			var s string
			if _, err := fmt.Fscan(f, &s); err != nil {
				return ctx.Throw(err.Error())
			}
			v, err := strconv.ParseFloat(s, 64)
			if err != nil {
				return ctx.Throw(err.Error())
			}
			return v
		}
		// fallback to process uptime
		return time.Since(processStart).Seconds()
	})

	// total and free memory
	mod.Export("totalmem", func(args js.Arguments) interface{} {
		if runtime.GOOS == "linux" {
			m, err := parseProcMeminfo()
			if err != nil {
				return ctx.Throw(err.Error())
			}
			if total, ok := m["MemTotal"]; ok {
				return float64(total)
			}
			return float64(0)
		}
		// best-effort fallback: return 0 on unsupported OS
		return float64(0)
	})

	mod.Export("freemem", func(args js.Arguments) interface{} {
		if runtime.GOOS == "linux" {
			m, err := parseProcMeminfo()
			if err != nil {
				return ctx.Throw(err.Error())
			}
			if v, ok := m["MemAvailable"]; ok {
				return float64(v)
			}
			if v, ok := m["MemFree"]; ok {
				return float64(v)
			}
			return float64(0)
		}
		return float64(0)
	})

	// load average
	mod.Export("loadavg", func(args js.Arguments) interface{} {
		if runtime.GOOS == "linux" {
			data, err := os.ReadFile("/proc/loadavg")
			if err != nil {
				return ctx.Throw(err.Error())
			}
			parts := strings.Fields(string(data))
			if len(parts) < 3 {
				return ctx.Throw("unexpected /proc/loadavg format")
			}
			a1, _ := strconv.ParseFloat(parts[0], 64)
			a5, _ := strconv.ParseFloat(parts[1], 64)
			a15, _ := strconv.ParseFloat(parts[2], 64)
			return []float64{a1, a5, a15}
		}
		return []float64{0, 0, 0}
	})

	// CPU info: return array [model, speed, user, nice, sys, idle, irq] repeated per CPU
	mod.Export("cpus", func(args js.Arguments) interface{} {
		// Try Linux /proc parsing first
		if runtime.GOOS == "linux" {
			cpus := []interface{}{}

			// parse /proc/cpuinfo for model and speed
			ciData, err := os.ReadFile("/proc/cpuinfo")
			if err != nil {
				return ctx.Throw(err.Error())
			}
			// build slice of map for model/speed per processor
			models := parseCPUInfo(string(ciData))

			// parse /proc/stat for cpu times
			statData, err := os.ReadFile("/proc/stat")
			if err != nil {
				return ctx.Throw(err.Error())
			}
			times := parseProcStat(string(statData))

			max := len(models)
			if len(times) > max {
				max = len(times)
			}

			for i := 0; i < max; i++ {
				model := ""
				speed := 0.0
				if i < len(models) {
					model = models[i].Model
					speed = models[i].Speed
				}
				var user, nice, sys, idle, irq float64
				if i < len(times) {
					user = times[i].User
					nice = times[i].Nice
					sys = times[i].Sys
					idle = times[i].Idle
					irq = times[i].Irq
				}
				cpus = append(cpus, map[string]interface{}{
					"model": model,
					"speed": speed,
					"times": map[string]float64{
						"user": user,
						"nice": nice,
						"sys":  sys,
						"idle": idle,
						"irq":  irq,
					},
				})
			}
			return cpus
		}
		// fallback: minimal info
		n := runtime.NumCPU()
		res := make([]interface{}, 0, n*7)
		for i := 0; i < n; i++ {
			res = append(res, map[string]interface{}{
				"model": "unknown",
				"speed": 0,
				"times": map[string]float64{
					"user": 0,
					"nice": 0,
					"sys":  0,
					"idle": 0,
					"irq":  0,
				},
			})
		}
		return res
	})

	// interface addresses
	mod.Export("networkInterfaces", func(args js.Arguments) interface{} {
		ifs, err := net.Interfaces()
		if err != nil {
			return ctx.Throw(err.Error())
		}

		obj := ctx.Object()

		for _, ifi := range ifs {
			res := []interface{}{}
			addrs, _ := ifi.Addrs()
			mac := ifi.HardwareAddr.String()
			isInternal := (ifi.Flags & net.FlagLoopback) != 0
			for _, a := range addrs {
				var ipStr, maskStr, family string
				scopeid := int64(-1)
				switch v := a.(type) {
				case *net.IPNet:
					ip := v.IP
					ipStr = ip.String()
					maskStr = net.IP(v.Mask).String()
					if ip.To4() != nil {
						family = "IPv4"
					} else {
						family = "IPv6"
					}
				case *net.IPAddr:
					ip := v.IP
					ipStr = ip.String()
					maskStr = ""
					if ip.To4() != nil {
						family = "IPv4"
					} else {
						family = "IPv6"
					}
				default:
					continue
				}

				res = append(res, map[string]interface{}{
					"address":  ipStr,
					"netmask":  maskStr,
					"family":   family,
					"mac":      mac,
					"internal": isInternal,
					"scopeid":  scopeid,
				})
			}

			obj.Set(ifi.Name, res)
		}

		return obj
	})

	// user info: {uid, gid, username, homedir, shell}
	mod.Export("userInfo", func(args js.Arguments) interface{} {
		u, err := user.Current()
		if err != nil {
			return ctx.Throw(err.Error())
		}
		uid := int64(0)
		gid := int64(0)
		if u.Uid != "" {
			if v, err := strconv.ParseInt(u.Uid, 10, 64); err == nil {
				uid = v
			}
		}
		if u.Gid != "" {
			if v, err := strconv.ParseInt(u.Gid, 10, 64); err == nil {
				gid = v
			}
		}
		shell := ""
		// On many systems, shell isn't provided by os/user; try environment fallback
		if s := os.Getenv("SHELL"); s != "" {
			shell = s
		}
		ret := map[string]interface{}{
			"uid":      uid,
			"gid":      gid,
			"username": u.Username,
			"homedir":  u.HomeDir,
			"shell":    shell,
		}
		return ret
	})

	// setPriority(pid, priority) -> errno or 0
	mod.Export("setPriority", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("setPriority requires (pid, priority)")
		}
		pid64, ok := args.Get(0).(int64)
		if !ok {
			return ctx.Throw("setPriority: pid must be a number")
		}
		prio, ok := args.Get(1).(int64)
		if !ok {
			return ctx.Throw("setPriority: priority must be a number")
		}
		err := unix.Setpriority(unix.PRIO_PROCESS, int(pid64), int(prio))
		if err != nil {
			return int64(-1)
		}
		return int64(0)
	})

	// getPriority(pid) -> priority or throw
	mod.Export("getPriority", func(args js.Arguments) interface{} {
		if args.Len() < 1 {
			return ctx.Throw("getPriority requires (pid)")
		}
		pid64, ok := args.Get(0).(int64)
		if !ok {
			return ctx.Throw("getPriority: pid must be a number")
		}
		prio, err := unix.Getpriority(unix.PRIO_PROCESS, int(pid64))
		if err != nil {
			return ctx.Throw(err.Error())
		}
		return int64(prio)
	})

	// available parallelism
	mod.Export("getAvailableParallelism", func(args js.Arguments) interface{} {
		return uint64(runtime.NumCPU())
	})

	// getOSInformation -> [sysname, version, release, machine]
	mod.Export("getOSInformation", func(args js.Arguments) interface{} {
		var uts unix.Utsname
		if err := unix.Uname(&uts); err != nil {
			return ctx.Throw(err.Error())
		}
		// convert utsname fields (which may be arrays of int8 or byte) to string
		utsToString := func(arr interface{}) string {
			// use reflection to handle []int8, []uint8, or arrays
			rv := reflect.ValueOf(arr)
			var bs []byte
			for i := 0; i < rv.Len(); i++ {
				v := rv.Index(i).Interface()
				switch c := v.(type) {
				case int8:
					if c == 0 {
						return string(bs)
					}
					bs = append(bs, byte(c))
				case uint8:
					if c == 0 {
						return string(bs)
					}
					bs = append(bs, byte(c))
				default:
					// unsupported element type, skip
				}
			}
			return string(bs)
		}
		sysname := utsToString(uts.Sysname)
		version := utsToString(uts.Version)
		release := utsToString(uts.Release)
		machine := utsToString(uts.Machine)
		return []interface{}{sysname, version, release, machine}
	})

	// EOL constant
	mod.Export("EOL", func(args js.Arguments) interface{} {
		if runtime.GOOS == "windows" {
			return "\r\n"
		}
		return "\n"
	})
}

// helpers
func parseProcMeminfo() (map[string]uint64, error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	m := map[string]uint64{}
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		rest := strings.TrimSpace(parts[1])
		fields := strings.Fields(rest)
		if len(fields) == 0 {
			continue
		}
		v, err := strconv.ParseUint(fields[0], 10, 64)
		if err != nil {
			continue
		}
		// value is in kB on Linux; convert to bytes
		m[key] = v * 1024
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return m, nil
}

type cpuModel struct {
	Model string
	Speed float64
}

func parseCPUInfo(data string) []cpuModel {
	models := []cpuModel{}
	scanner := bufio.NewScanner(strings.NewReader(data))
	current := cpuModel{}
	has := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			if has {
				models = append(models, current)
				current = cpuModel{}
				has = false
			}
			continue
		}
		if parts := strings.SplitN(line, ":", 2); len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			switch k {
			case "model name":
				current.Model = v
				has = true
			case "cpu MHz":
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					current.Speed = f
					has = true
				}
			}
		}
	}
	if has {
		models = append(models, current)
	}
	return models
}

type cpuTimes struct {
	User float64
	Nice float64
	Sys  float64
	Idle float64
	Irq  float64
}

func parseProcStat(data string) []cpuTimes {
	res := []cpuTimes{}
	scanner := bufio.NewScanner(strings.NewReader(data))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu") {
			continue
		}
		// skip aggregate cpu line "cpu " (without index)
		if len(line) >= 4 && line[3] == ' ' {
			continue
		}
		fields := strings.Fields(line)
		// fields[0] == cpuN
		if len(fields) < 8 {
			continue
		}
		// indexes: 1=user,2=nice,3=system,4=idle,5=iowait,6=irq
		user, _ := strconv.ParseFloat(fields[1], 64)
		nice, _ := strconv.ParseFloat(fields[2], 64)
		sys, _ := strconv.ParseFloat(fields[3], 64)
		idle, _ := strconv.ParseFloat(fields[4], 64)
		irq := 0.0
		if len(fields) > 6 {
			irq, _ = strconv.ParseFloat(fields[6], 64)
		}
		res = append(res, cpuTimes{User: user, Nice: nice, Sys: sys, Idle: idle, Irq: irq})
	}
	return res
}
