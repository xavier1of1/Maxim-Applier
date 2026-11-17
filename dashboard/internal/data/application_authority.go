package data

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type ApplicationAuthorityState struct {
	Applications     string            `json:"applications"`
	ApplicationAsOf  string            `json:"applicationAsOf"`
	ApplicationFiles map[string]string `json:"applicationFiles"`
}

func ReadApplicationAuthority(root string) (ApplicationAuthorityState, error) {
	var state ApplicationAuthorityState
	bytes, err := os.ReadFile(filepath.Join(root, "data", "maxim", "authority.json"))
	if os.IsNotExist(err) {
		state.Applications = "legacy"
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if err = json.Unmarshal(bytes, &state); err != nil {
		return state, fmt.Errorf("authority marker is unreadable; legacy fallback refused")
	}
	if state.Applications == "" {
		state.Applications = "legacy"
	}
	if state.Applications != "legacy" && state.Applications != "canonical" && state.Applications != "frozen" {
		return state, fmt.Errorf("unsupported application authority")
	}
	return state, nil
}

func VerifyApplicationProjection(root, relative string, bytes []byte) error {
	state, err := ReadApplicationAuthority(root)
	if err != nil {
		return err
	}
	if state.Applications == "frozen" {
		return fmt.Errorf("application projections are frozen for recovery")
	}
	if state.Applications != "canonical" {
		return nil
	}
	sum := sha256.Sum256(bytes)
	if state.ApplicationFiles[filepath.ToSlash(relative)] != hex.EncodeToString(sum[:]) {
		return fmt.Errorf("canonical application projection integrity failed; refresh/recover the workspace")
	}
	return nil
}

// A short file lease lets cutover wait for an already-started native status edit.
func beginLegacyApplicationWrite(root string) (func(), error) {
	resolved, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	resolved, err = filepath.EvalSymlinks(resolved)
	if err != nil {
		return nil, err
	}
	check := func() error {
		state, e := ReadApplicationAuthority(resolved)
		if e != nil {
			return e
		}
		if state.Applications != "legacy" {
			return fmt.Errorf("applications are %s; use authenticated Maxim workspace commands (offline writes refused)", state.Applications)
		}
		return nil
	}
	if err = check(); err != nil {
		return nil, err
	}
	parent := filepath.Join(resolved, "data", "maxim")
	for _, p := range []string{filepath.Join(resolved, "data"), parent} {
		if info, e := os.Lstat(p); e == nil && info.Mode()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("linked application lease directory refused")
		}
	}
	if err = os.MkdirAll(parent, 0700); err != nil {
		return nil, err
	}
	lock := filepath.Join(parent, "application-write.lock")
	acquired := false
	for i := 0; i < 40; i++ {
		if e := os.Mkdir(lock, 0700); e == nil {
			acquired = true
			break
		} else if !os.IsExist(e) {
			return nil, e
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !acquired {
		return nil, fmt.Errorf("application writer busy; no edit acknowledged")
	}
	random := make([]byte, 16)
	if _, err = rand.Read(random); err != nil {
		_ = os.Remove(lock)
		return nil, err
	}
	token := fmt.Sprintf("%x-%x-%x-%x-%x", random[0:4], random[4:6], random[6:8], random[8:10], random[10:16])
	record := struct {
		PID       int    `json:"pid"`
		Token     string `json:"token"`
		StartedAt string `json:"startedAt"`
	}{os.Getpid(), token, time.Now().UTC().Format(time.RFC3339Nano)}
	payload, _ := json.Marshal(record)
	file := filepath.Join(lock, "owner.json")
	if err = os.WriteFile(file, payload, 0600); err != nil {
		_ = os.Remove(lock)
		return nil, err
	}
	release := func() {
		actual, e := filepath.EvalSymlinks(lock)
		if e != nil || actual != lock {
			return
		}
		current, e := os.ReadFile(file)
		if e != nil {
			return
		}
		var owner struct {
			Token string `json:"token"`
		}
		if json.Unmarshal(current, &owner) != nil || owner.Token != token {
			return
		}
		entries, e := os.ReadDir(lock)
		if e != nil || len(entries) != 1 || entries[0].Name() != "owner.json" {
			return
		}
		_ = os.Remove(file)
		_ = os.Remove(lock)
	}
	if err = check(); err != nil {
		release()
		return nil, err
	}
	return release, nil
}
