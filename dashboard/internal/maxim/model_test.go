package maxim

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	careermodel "github.com/santifer/career-ops/dashboard/internal/model"
	"github.com/santifer/career-ops/dashboard/internal/theme"
)

func writeSnapshot(t *testing.T, root string) {
	t.Helper()
	target := filepath.Join(root, "data", "maxim")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	snapshot := `{
  "generatedAt": "2026-06-03T12:00:00Z",
  "todayActions": [
    {
      "actionType": "job",
      "title": "Federal Platform Labs - Software Engineer",
      "detail": "urgent high-conviction action",
      "status": "T3",
      "job": {"id": "job_1", "company": "Federal Platform Labs", "role": "Software Engineer", "score": 4.6, "tier": "T3", "nextAction": "urgent high-conviction action", "flags": ["fresh:urgent"]}
    }
  ],
  "highConvictionJobs": [
    {"id": "job_1", "company": "Federal Platform Labs", "role": "Software Engineer", "score": 4.6, "tier": "T3", "nextAction": "urgent high-conviction action", "flags": ["fresh:urgent"]}
  ],
  "networkingQueue": [
    {"jobID": "job_1", "title": "Federal Platform Labs - Software Engineer", "detail": "Example Recruiter: Same company.", "status": "ready_to_research"}
  ],
  "recruiterInbox": [
    {"id": "thread_1", "subject": "Fixture recruiter follow-up", "company": "Federal Platform Labs", "status": "Needs Response", "needsResponse": true, "detail": "Reply manually."}
  ],
  "applications": [
    {"id": "app_1", "jobID": "job_1", "company": "Federal Platform Labs", "role": "Software Engineer", "status": "submitted_manually", "score": 4.6, "tier": "T3", "packetReady": true, "pdfPath": "output/fixture.pdf", "reportPath": "reports/fixture.md", "jobURL": "https://example.invalid", "duplicateRisk": "none", "nextAction": "Review packet and submit manually."}
  ],
  "analytics": {
    "trackerRowCount": 1,
    "novaDCCompatibleCount": 1,
    "smallSampleWarning": "Small sample: 1 NoVA/DC-compatible records. Treat recommendations as directional.",
    "primaryKPIDescription": "Interview rate percentage for NoVA/DC-compatible roles.",
    "recommendationScaffold": "Small sample warning."
  }
}`
	if err := os.WriteFile(filepath.Join(target, "dashboard-state.json"), []byte(snapshot), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestMaximDashboardScreensRenderFromSnapshot(t *testing.T) {
	root := t.TempDir()
	writeSnapshot(t, root)
	model := NewModel(theme.NewTheme("auto"), []careermodel.CareerApplication{}, root, 120, 40)

	expected := []string{
		"Today",
		"High Conviction",
		"Networking",
		"Recruiter Inbox",
		"Applications",
		"Analytics",
		"Settings",
	}

	for i, label := range expected {
		view := model.View()
		if !strings.Contains(view, "MAXIM APPLY") {
			t.Fatalf("screen %s did not render Maxim header", label)
		}
		if !strings.Contains(view, label) {
			t.Fatalf("screen %s did not render its label", label)
		}
		if i < len(expected)-1 {
			updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("l")})
			model = updated
		}
	}
}

func TestMaximDashboardEmptyStatesAreUseful(t *testing.T) {
	model := NewModel(theme.NewTheme("auto"), []careermodel.CareerApplication{}, t.TempDir(), 120, 40)
	view := model.View()
	if !strings.Contains(view, "No urgent Maxim actions yet") {
		t.Fatalf("Today empty state should explain how to populate Maxim actions")
	}
	if !strings.Contains(view, "npm run maxim:sync") {
		t.Fatalf("Today empty state should point to maxim:sync")
	}
}
