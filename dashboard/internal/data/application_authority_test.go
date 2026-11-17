package data

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/santifer/career-ops/dashboard/internal/model"
)

func TestApplicationAuthorityRefusesCanonicalAndCorruptWrites(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "data", "maxim")
	if err := os.MkdirAll(directory, 0700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(directory, "authority.json")
	for _, content := range []string{`{"applications":"canonical"}`, `{"applications":"frozen"}`, `{"applications":"unsupported"}`, `not json`} {
		if err := os.WriteFile(file, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		if err := UpdateApplicationStatus(root, model.CareerApplication{ReportNumber: "001", Status: "Evaluated"}, "Applied"); err == nil {
			t.Fatal("unsafe/no-op status write was acknowledged")
		}
	}
}
func TestCanonicalProjectionIntegrityAndEntityDecoding(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "data", "maxim")
	_ = os.MkdirAll(directory, 0700)
	text := "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 1 | 2026-11-17 | Acme &#124; Labs | Engineer | ? | Evaluated | No | - | MaximId=fixture |\n"
	sum := sha256.Sum256([]byte(text))
	state := ApplicationAuthorityState{Applications: "canonical", ApplicationFiles: map[string]string{"applications.md": hex.EncodeToString(sum[:])}}
	marker, _ := json.Marshal(state)
	_ = os.WriteFile(filepath.Join(directory, "authority.json"), marker, 0600)
	_ = os.WriteFile(filepath.Join(root, "applications.md"), []byte(text), 0600)
	rows := ParseApplications(root)
	if len(rows) != 1 || rows[0].Company != "Acme | Labs" || rows[0].ScoreRaw != "?" {
		t.Fatalf("projection mismatch: %#v", rows)
	}
	_ = os.WriteFile(filepath.Join(root, "applications.md"), []byte(text+"tampered"), 0600)
	if len(ParseApplications(root)) != 0 {
		t.Fatal("tampered canonical projection was read as trusted data")
	}
}
func TestCanonicalProjectionFixture(t *testing.T) {
	root := os.Getenv("MAXIM_TEST_NATIVE_ROOT")
	if root == "" {
		t.Skip("explicit isolated integration fixture only")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}
	temp, err := filepath.Abs(os.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(absolute) != "native" || !strings.HasPrefix(filepath.Base(filepath.Dir(absolute)), "maxim-test-") || !strings.HasPrefix(strings.ToLower(absolute), strings.ToLower(temp)+string(os.PathSeparator)) {
		t.Fatal("production fixture fallback refused")
	}
	rows := ParseApplications(root)
	if len(rows) < 2 {
		t.Fatalf("expected canonical records: %#v", rows)
	}
	if !strings.Contains(rows[0].Notes, "MaximId=") {
		t.Fatal("canonical ID missing from native projection")
	}
	if id := os.Getenv("MAXIM_TEST_EXPECTED_APPLICATION"); id != "" {
		found := false
		for _, row := range rows {
			if strings.Contains(row.Notes, "MaximId="+id) {
				found = true
				if !strings.EqualFold(row.Status, os.Getenv("MAXIM_TEST_EXPECTED_STATUS")) {
					t.Fatalf("native status disagrees with canonical API: %s", row.Status)
				}
			}
		}
		if !found {
			t.Fatal("expected canonical UUID missing after restart")
		}
	}
	if err := UpdateApplicationStatus(root, rows[0], "Offer"); err == nil {
		t.Fatal("native writer bypassed canonical owner")
	}
}
