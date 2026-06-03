package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/santifer/career-ops/dashboard/internal/data"
	careermodel "github.com/santifer/career-ops/dashboard/internal/model"
)

// DashboardService is the Maxim dashboard seam. Screens consume DTOs from this
// interface rather than parsing raw files or querying implementation storage.
type DashboardService interface {
	LoadToday() ([]TodayActionDTO, error)
	LoadHighConviction() ([]JobDTO, error)
	LoadNetworking() ([]NetworkingDTO, error)
	LoadRecruiterInbox() ([]RecruiterThreadDTO, error)
	LoadAnalytics() (AnalyticsDTO, error)
	RecordDecision(UserDecisionDTO) error
	Refresh() error
}

// JobDTO is the dashboard-safe shape for a Maxim-routed job.
type JobDTO struct {
	ID         string
	Company    string
	Role       string
	Score      float64
	Tier       string
	NextAction string
	Flags      []string
}

// TodayActionDTO is a dashboard-ready action item.
type TodayActionDTO struct {
	ActionType string
	Title      string
	Detail     string
	Status     string
	Job        JobDTO
}

// NetworkingDTO summarizes shortlist readiness without sending messages.
type NetworkingDTO struct {
	JobID  string
	Title  string
	Detail string
	Status string
}

// RecruiterThreadDTO summarizes manual recruiter inbox state.
type RecruiterThreadDTO struct {
	ID            string
	Subject       string
	Company       string
	Status        string
	NeedsResponse bool
	Detail        string
}

// AnalyticsDTO summarizes dashboard metrics without exposing storage details.
type AnalyticsDTO struct {
	TrackerRowCount        int
	NovaDCCompatibleCount  int
	SmallSampleWarning     string
	PrimaryKPIDescription  string
	RecommendationScaffold string
}

type dashboardSnapshot struct {
	GeneratedAt         string               `json:"generatedAt"`
	TodayActions       []TodayActionDTO     `json:"todayActions"`
	HighConvictionJobs []JobDTO             `json:"highConvictionJobs"`
	NetworkingQueue    []NetworkingDTO      `json:"networkingQueue"`
	RecruiterInbox     []RecruiterThreadDTO `json:"recruiterInbox"`
	Analytics          AnalyticsDTO         `json:"analytics"`
}

// UserDecisionDTO is reserved for future dashboard-driven manual decisions.
type UserDecisionDTO struct {
	EntityType string
	EntityID   string
	Decision   string
	Reason     string
}

// CareerOpsService adapts native Career-Ops tracker rows into Maxim dashboard DTOs.
type CareerOpsService struct {
	apps          []careermodel.CareerApplication
	jobs          []JobDTO
	careerOpsPath string
	snapshot      *dashboardSnapshot
}

// NewCareerOpsService creates a dashboard service from already-loaded Career-Ops rows.
func NewCareerOpsService(apps []careermodel.CareerApplication, careerOpsPath string) *CareerOpsService {
	s := &CareerOpsService{apps: apps, careerOpsPath: careerOpsPath}
	_ = s.Refresh()
	return s
}

// Refresh rebuilds dashboard DTOs from the current tracker snapshot.
func (s *CareerOpsService) Refresh() error {
	s.snapshot = loadSnapshot(s.careerOpsPath)
	s.jobs = make([]JobDTO, 0, len(s.apps))
	for _, app := range s.apps {
		tier := maximTier(app.Score)
		flags := maximFlags(app)
		s.jobs = append(s.jobs, JobDTO{
			ID:         jobID(app),
			Company:    app.Company,
			Role:       app.Role,
			Score:      app.Score,
			Tier:       tier,
			NextAction: nextAction(tier, flags),
			Flags:      flags,
		})
	}
	sort.SliceStable(s.jobs, func(i, j int) bool { return s.jobs[i].Score > s.jobs[j].Score })
	return nil
}

// LoadToday returns urgent Maxim actions derived from Career-Ops tracker data.
func (s *CareerOpsService) LoadToday() ([]TodayActionDTO, error) {
	if s.snapshot != nil {
		return s.snapshot.TodayActions, nil
	}
	var actions []TodayActionDTO
	for _, job := range s.jobs {
		if job.Tier == "T3" || (job.Tier == "T2" && hasFlag(job.Flags, "fresh")) {
			actions = append(actions, TodayActionDTO{
				ActionType: "job",
				Title:      fmt.Sprintf("%s - %s", job.Company, job.Role),
				Detail:     job.NextAction,
				Status:     job.Tier,
				Job:        job,
			})
		}
	}
	return actions, nil
}

// LoadHighConviction returns T3 and priority-overlay T2 jobs.
func (s *CareerOpsService) LoadHighConviction() ([]JobDTO, error) {
	if s.snapshot != nil {
		return s.snapshot.HighConvictionJobs, nil
	}
	var jobs []JobDTO
	for _, job := range s.jobs {
		if job.Tier == "T3" || (job.Tier == "T2" && hasFlag(job.Flags, "priority")) {
			jobs = append(jobs, job)
		}
	}
	return jobs, nil
}

// LoadNetworking returns role-level queue hints. Message generation remains manual.
func (s *CareerOpsService) LoadNetworking() ([]NetworkingDTO, error) {
	if s.snapshot != nil {
		return s.snapshot.NetworkingQueue, nil
	}
	var queue []NetworkingDTO
	for _, job := range s.jobs {
		if job.Tier == "T2" || job.Tier == "T3" {
			queue = append(queue, NetworkingDTO{
				JobID:  job.ID,
				Title:  fmt.Sprintf("%s - %s", job.Company, job.Role),
				Detail: "Eligible for shortlist generation with npm run maxim:networking.",
				Status: "ready_to_research",
			})
		}
	}
	return queue, nil
}

// LoadRecruiterInbox returns a dashboard-safe empty state until stored recruiter DTOs are wired in.
func (s *CareerOpsService) LoadRecruiterInbox() ([]RecruiterThreadDTO, error) {
	if s.snapshot != nil {
		return s.snapshot.RecruiterInbox, nil
	}
	return []RecruiterThreadDTO{}, nil
}

// LoadAnalytics returns the dashboard KPI scaffold from tracker rows.
func (s *CareerOpsService) LoadAnalytics() (AnalyticsDTO, error) {
	if s.snapshot != nil {
		return s.snapshot.Analytics, nil
	}
	count := 0
	for _, app := range s.apps {
		if locationAllowed(app) {
			count++
		}
	}
	warning := ""
	if count < 20 {
		warning = fmt.Sprintf("Small sample: %d NoVA/DC-compatible records. Treat recommendations as directional.", count)
	}
	return AnalyticsDTO{
		TrackerRowCount:        len(s.apps),
		NovaDCCompatibleCount:  count,
		SmallSampleWarning:     warning,
		PrimaryKPIDescription:  "Interview rate percentage for NoVA/DC-compatible roles.",
		RecommendationScaffold: "Run npm run maxim:analytics for a persisted MetricSnapshot.",
	}, nil
}

// RecordDecision is present for the v1 dashboard seam; writes remain CLI-backed for now.
func (s *CareerOpsService) RecordDecision(UserDecisionDTO) error {
	return nil
}

func loadSnapshot(careerOpsPath string) *dashboardSnapshot {
	if careerOpsPath == "" {
		careerOpsPath = "."
	}
	path := filepath.Join(careerOpsPath, "data", "maxim", "dashboard-state.json")
	bytes, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var snapshot dashboardSnapshot
	if err := json.Unmarshal(bytes, &snapshot); err != nil {
		return nil
	}
	return &snapshot
}

func jobID(app careermodel.CareerApplication) string {
	if app.Number > 0 {
		return fmt.Sprintf("careerops_%d", app.Number)
	}
	return strings.ToLower(strings.NewReplacer(" ", "_", "/", "_", "\\", "_").Replace(app.Company + "_" + app.Role))
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
