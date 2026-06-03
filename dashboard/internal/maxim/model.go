package maxim

import (
	"fmt"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/santifer/career-ops/dashboard/internal/data"
	careermodel "github.com/santifer/career-ops/dashboard/internal/model"
	"github.com/santifer/career-ops/dashboard/internal/theme"
)

// ClosedMsg is emitted when the Maxim dashboard mode should close.
type ClosedMsg struct{}

type screenName string

const (
	screenToday          screenName = "Today"
	screenHighConviction screenName = "High Conviction"
	screenNetworking     screenName = "Networking"
	screenRecruiter      screenName = "Recruiter Inbox"
	screenAnalytics      screenName = "Analytics"
	screenSettings       screenName = "Settings"
)

var screens = []screenName{
	screenToday,
	screenHighConviction,
	screenNetworking,
	screenRecruiter,
	screenAnalytics,
	screenSettings,
}

type tieredJob struct {
	app        careermodel.CareerApplication
	tier       string
	nextAction string
	flags      []string
}

// Model renders the Maxim Apply command-center mode.
type Model struct {
	apps          []careermodel.CareerApplication
	width, height int
	theme         theme.Theme
	activeScreen  int
}

// NewModel creates a Maxim command-center screen from native Career-Ops data.
func NewModel(t theme.Theme, apps []careermodel.CareerApplication, width, height int) Model {
	return Model{apps: apps, width: width, height: height, theme: t}
}

// Resize updates dimensions.
func (m *Model) Resize(width, height int) {
	m.width = width
	m.height = height
}

// Update handles key input.
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "q", "m":
			return m, func() tea.Msg { return ClosedMsg{} }
		case "right", "l", "tab":
			m.activeScreen = (m.activeScreen + 1) % len(screens)
		case "left", "h", "shift+tab":
			m.activeScreen--
			if m.activeScreen < 0 {
				m.activeScreen = len(screens) - 1
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}
	return m, nil
}

// View renders the active Maxim screen.
func (m Model) View() string {
	sections := []string{m.renderHeader(), m.renderTabs()}
	switch screens[m.activeScreen] {
	case screenToday:
		sections = append(sections, m.renderToday())
	case screenHighConviction:
		sections = append(sections, m.renderHighConviction())
	case screenNetworking:
		sections = append(sections, m.renderNetworking())
	case screenRecruiter:
		sections = append(sections, m.renderRecruiter())
	case screenAnalytics:
		sections = append(sections, m.renderAnalytics())
	case screenSettings:
		sections = append(sections, m.renderSettings())
	}
	sections = append(sections, m.renderHelp())
	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

func (m Model) renderHeader() string {
	style := lipgloss.NewStyle().Bold(true).Foreground(m.theme.Text).Background(m.theme.Surface).Width(m.width).Padding(0, 2)
	title := lipgloss.NewStyle().Bold(true).Foreground(m.theme.Green).Render("MAXIM APPLY")
	info := lipgloss.NewStyle().Foreground(m.theme.Subtext).Render("Career-Ops fork command center")
	gap := m.width - lipgloss.Width(title) - lipgloss.Width(info) - 4
	if gap < 1 {
		gap = 1
	}
	return style.Render(title + strings.Repeat(" ", gap) + info)
}

func (m Model) renderTabs() string {
	var parts []string
	for i, screen := range screens {
		label := fmt.Sprintf(" %s ", screen)
		style := lipgloss.NewStyle().Foreground(m.theme.Subtext)
		if i == m.activeScreen {
			style = style.Bold(true).Foreground(m.theme.Green)
		}
		parts = append(parts, style.Render(label))
	}
	return lipgloss.NewStyle().Padding(0, 1).Render(strings.Join(parts, ""))
}

func (m Model) renderToday() string {
	jobs := m.tieredJobs()
	urgent := filterJobs(jobs, func(job tieredJob) bool {
		return job.tier == "T3" || (job.tier == "T2" && hasFlag(job.flags, "fresh"))
	})
	return m.renderJobList("Today", "Urgent roles, application packets, recruiter replies, and draft-ready networking actions.", urgent, "No urgent Maxim actions yet. Run Career-Ops evaluations, then npm run maxim:sync.")
}

func (m Model) renderHighConviction() string {
	jobs := filterJobs(m.tieredJobs(), func(job tieredJob) bool {
		return job.tier == "T3" || (job.tier == "T2" && hasFlag(job.flags, "priority"))
	})
	return m.renderJobList("High Conviction", "T3 roles and priority T2 roles. Career-Ops score remains the fit source.", jobs, "No high-conviction roles are available yet.")
}

func (m Model) renderNetworking() string {
	return m.panel("Networking", "LinkedIn workflow is discover, rank, research, draft, and manually send. No bot sending.", []string{
		fmt.Sprintf("%d T2/T3 roles can feed shortlist generation.", len(filterJobs(m.tieredJobs(), func(job tieredJob) bool { return job.tier == "T2" || job.tier == "T3" }))),
		"Run npm run maxim:networking -- job.json contacts.json for JSON shortlist generation.",
		"Ready-to-send message drafts must pass the five-part structure validator.",
	})
}

func (m Model) renderRecruiter() string {
	return m.panel("Recruiter Inbox", "Manual recruiter thread tracking lives in Maxim state and can surface Needs Response reminders.", []string{
		"Use npm run maxim:notify for dry-run reminder planning.",
		"Use node maxim/scripts/recruiter-inbox.mjs create \"Subject\" \"Company\" for manual thread creation payloads.",
		"Needs Response clears when a reply is recorded or manually marked responded.",
	})
}

func (m Model) renderAnalytics() string {
	applicable := filterJobs(m.tieredJobs(), func(job tieredJob) bool { return locationAllowed(job.app) })
	return m.panel("Analytics", "Primary KPI is interview rate percentage for NoVA/DC-compatible roles.", []string{
		fmt.Sprintf("%d tracker rows are NoVA/DC-compatible based on report notes/location text available to the dashboard.", len(applicable)),
		"Run npm run maxim:analytics to create a local MetricSnapshot.",
		"Small samples stay advisory and never auto-change scoring.",
	})
}

func (m Model) renderSettings() string {
	return m.panel("Settings", "Current default Xavier policies.", []string{
		"Allowed locations: Northern Virginia and Washington, DC. Maryland excluded by default.",
		"Salary hard minimum: $85k. T3 flat minimum: $90k.",
		"U.S. citizen: yes. Active clearance: no. Willing/eligible to obtain clearance: yes.",
		"Discord webhook is read from MAXIM_DISCORD_WEBHOOK_URL for live sends.",
	})
}

func (m Model) renderJobList(title, subtitle string, jobs []tieredJob, empty string) string {
	if len(jobs) == 0 {
		return m.panel(title, subtitle, []string{empty})
	}
	var lines []string
	for _, job := range jobs {
		flags := strings.Join(job.flags, ", ")
		if flags == "" {
			flags = "no overlays"
		}
		lines = append(lines, fmt.Sprintf("%s | %.1f/5 | %s | %s | %s", job.tier, job.app.Score, job.app.Company, job.app.Role, flags))
		lines = append(lines, "  next: "+job.nextAction)
	}
	return m.panel(title, subtitle, lines)
}

func (m Model) panel(title, subtitle string, lines []string) string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(m.theme.Green)
	subtitleStyle := lipgloss.NewStyle().Foreground(m.theme.Subtext)
	bodyStyle := lipgloss.NewStyle().Foreground(m.theme.Text)
	rendered := []string{titleStyle.Render(title), subtitleStyle.Render(subtitle), ""}
	for _, line := range lines {
		rendered = append(rendered, bodyStyle.Render("- "+line))
	}
	return lipgloss.NewStyle().Padding(1, 2).Width(m.width).Render(strings.Join(rendered, "\n"))
}

func (m Model) renderHelp() string {
	keyStyle := lipgloss.NewStyle().Bold(true).Foreground(m.theme.Text)
	descStyle := lipgloss.NewStyle().Foreground(m.theme.Subtext)
	return lipgloss.NewStyle().Foreground(m.theme.Subtext).Background(m.theme.Surface).Width(m.width).Padding(0, 1).Render(
		keyStyle.Render("<-/h") + descStyle.Render(" previous  ") +
			keyStyle.Render("->/l") + descStyle.Render(" next  ") +
			keyStyle.Render("m/q/esc") + descStyle.Render(" back to Career-Ops"),
	)
}

func (m Model) tieredJobs() []tieredJob {
	var jobs []tieredJob
	for _, app := range m.apps {
		tier := maximTier(app.Score)
		flags := maximFlags(app)
		jobs = append(jobs, tieredJob{app: app, tier: tier, nextAction: nextAction(tier, flags), flags: flags})
	}
	sort.SliceStable(jobs, func(i, j int) bool { return jobs[i].app.Score > jobs[j].app.Score })
	return jobs
}

func maximTier(score float64) string {
	switch {
	case score < 3.5:
		return "T0"
	case score < 4.0:
		return "T1"
	case score < 4.5:
		return "T2"
	default:
		return "T3"
	}
}

func maximFlags(app careermodel.CareerApplication) []string {
	var flags []string
	if locationAllowed(app) {
		flags = append(flags, "NoVA/DC")
	}
	notes := strings.ToLower(app.Notes)
	if strings.Contains(notes, "connection") || strings.Contains(notes, "referral") || strings.Contains(notes, "recruiter") {
		flags = append(flags, "priority")
	}
	if data.NormalizeStatus(app.Status) == "evaluated" && app.Score >= 4.0 {
		flags = append(flags, "packet-ready-check")
	}
	return flags
}

func nextAction(tier string, flags []string) string {
	if tier == "T0" {
		return "no apply / reject"
	}
	if tier == "T1" {
		return "strategic override only"
	}
	if hasFlag(flags, "priority") {
		return "build networking shortlist"
	}
	if tier == "T3" {
		return "urgent high-conviction action"
	}
	return "prepare application packet"
}

func locationAllowed(app careermodel.CareerApplication) bool {
	text := strings.ToLower(app.Notes + " " + app.Role + " " + app.Company)
	for _, marker := range []string{"northern virginia", "washington, dc", "washington dc", "arlington", "alexandria", "fairfax", "reston", "herndon", "chantilly", "tysons", "mclean", "ashburn", "manassas", "gainesville"} {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
}

func hasFlag(flags []string, flag string) bool {
	for _, item := range flags {
		if item == flag {
			return true
		}
	}
	return false
}

func filterJobs(jobs []tieredJob, keep func(tieredJob) bool) []tieredJob {
	var filtered []tieredJob
	for _, job := range jobs {
		if keep(job) {
			filtered = append(filtered, job)
		}
	}
	return filtered
}
