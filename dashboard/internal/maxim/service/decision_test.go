package service

import (
	"math"
	"testing"
)

func TestDecisionCannotAcknowledgeNoOp(t *testing.T) {
	service := NewCareerOpsService(nil, t.TempDir())
	if service.RecordDecision(UserDecisionDTO{EntityType: "Application", EntityID: "fixture", Decision: "submitted"}) == nil {
		t.Fatal("unimplemented decision acknowledged")
	}
}
func TestInvalidScoreIsUnknownNotT0(t *testing.T) {
	for _, score := range []float64{0, -1, 5.1, math.NaN(), math.Inf(1)} {
		if maximTier(score) != "Unknown" {
			t.Fatalf("invalid score became a fit tier: %v", score)
		}
	}
}
