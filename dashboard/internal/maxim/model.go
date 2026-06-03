package maxim

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	maximservice "github.com/santifer/career-ops/dashboard/internal/maxim/service"
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

// Model renders the Maxim Apply command-center mode.
type Model struct {
	service      maximservice.DashboardService
	width, height int
	theme         theme.Theme
	activeScreen  int
}

// NewModel creates a Maxim command-center screen from native Career-Ops data.
func NewModel(t theme.Theme, apps []careermodel.CareerApplication, width, height int) Model {
	return Model{service: maximservice.NewCareerOpsService(apps), width: width, height: height, theme: t}
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
	actions, err := m.service.LoadToday()
	if err != nil {
		return m.panel("Today", "Urgent roles, application packets, recruiter replies, and draft-ready networking actions.", []string{"Could not load Today actions: " + err.Error()})
	}
	if len(actions) == 0 {
		return m.panel("Today", "Urgent roles, application packets, recruiter replies, and draft-ready networking actions.", []string{"No urgent Maxim actions yet. Run Career-Ops evaluations, then npm run maxim:sync."})
	}
	var lines []string
	for _, action := range actions {
		lines = append(lines, fmt.Sprintf("%s | %s | %s", action.Status, action.Title, action.Detail))
	}
	return m.panel("Today", "Urgent roles, application packets, recruiter replies, and draft-ready networking actions.", lines)
}

func (m Model) renderHighConviction() string {
	jobs, err := m.service.LoadHighConviction()
	if err != nil {
		return m.panel("High Conviction", "T3 roles and priority T2 roles. Career-Ops score remains the fit source.", []string{"Could not load high-conviction roles: " + err.Error()})
	}
	return m.renderJobList("High Conviction", "T3 roles and priority T2 roles. Career-Ops score remains the fit source.", jobs, "No high-conviction roles are available yet.")
}

func (m Model) renderNetworking() string {
	queue, err := m.service.LoadNetworking()
	if err != nil {
		return m.panel("Networking", "LinkedIn workflow is discover, rank, research, draft, and manually send. No bot sending.", []string{"Could not load networking queue: " + err.Error()})
	}
	return m.panel("Networking", "LinkedIn workflow is discover, rank, research, draft, and manually send. No bot sending.", []string{
		fmt.Sprintf("%d T2/T3 roles can feed shortlist generation.", len(queue)),
		"Run npm run maxim:networking -- job.json contacts.json for JSON shortlist generation.",
		"Ready-to-send message drafts must pass the five-part structure validator.",
	})
}

func (m Model) renderRecruiter() string {
	threads, err := m.service.LoadRecruiterInbox()
	if err != nil {
		return m.panel("Recruiter Inbox", "Manual recruiter thread tracking lives in Maxim state and can surface Needs Response reminders.", []string{"Could not load recruiter inbox: " + err.Error()})
	}
	if len(threads) > 0 {
		var lines []string
		for _, thread := range threads {
			lines = append(lines, fmt.Sprintf("%s | %s | %s", thread.Status, thread.Company, thread.Subject))
		}
		return m.panel("Recruiter Inbox", "Manual recruiter thread tracking lives in Maxim state and can surface Needs Response reminders.", lines)
	}
	return m.panel("Recruiter Inbox", "Manual recruiter thread tracking lives in Maxim state and can surface Needs Response reminders.", []string{
		"Use npm run maxim:notify for dry-run reminder planning.",
		"Use node maxim/scripts/recruiter-inbox.mjs create \"Subject\" \"Company\" for manual thread creation payloads.",
		"Needs Response clears when a reply is recorded or manually marked responded.",
	})
}

func (m Model) renderAnalytics() string {
	analytics, err := m.service.LoadAnalytics()
	if err != nil {
		return m.panel("Analytics", "Primary KPI is interview rate percentage for NoVA/DC-compatible roles.", []string{"Could not load analytics: " + err.Error()})
	}
	warning := analytics.SmallSampleWarning
	if warning == "" {
		warning = "Sample size is sufficient for directional comparison."
	}
	return m.panel("Analytics", "Primary KPI is interview rate percentage for NoVA/DC-compatible roles.", []string{
		fmt.Sprintf("%d of %d tracker rows are NoVA/DC-compatible based on dashboard DTOs.", analytics.NovaDCCompatibleCount, analytics.TrackerRowCount),
		"Run npm run maxim:analytics to create a local MetricSnapshot.",
		warning,
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

func (m Model) renderJobList(title, subtitle string, jobs []maximservice.JobDTO, empty string) string {
	if len(jobs) == 0 {
		return m.panel(title, subtitle, []string{empty})
	}
	var lines []string
	for _, job := range jobs {
		flags := strings.Join(job.Flags, ", ")
		if flags == "" {
			flags = "no overlays"
		}
		lines = append(lines, fmt.Sprintf("%s | %.1f/5 | %s | %s | %s", job.Tier, job.Score, job.Company, job.Role, flags))
		lines = append(lines, "  next: "+job.NextAction)
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
