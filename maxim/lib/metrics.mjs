const INTERVIEW_OUTCOMES = new Set(["interview", "interview_signal", "phone_screen", "offer"]);

function isNovaDc(record) {
  const text = `${record.locationText ?? record.location ?? record.locations ?? ""}`.toLowerCase();
  return ["northern virginia", "washington, dc", "washington dc", "arlington", "alexandria", "fairfax", "reston", "herndon", "chantilly", "tysons", "mclean", "ashburn", "manassas", "gainesville"].some((marker) => text.includes(marker));
}

export function computeInterviewRate(records = []) {
  const eligible = records.filter(isNovaDc);
  const interviews = eligible.filter((record) =>
    INTERVIEW_OUTCOMES.has(`${record.outcome ?? record.normalizedOutcome ?? record.status ?? ""}`.toLowerCase()),
  );
  return {
    numerator: interviews.length,
    denominator: eligible.length,
    value: eligible.length === 0 ? 0 : interviews.length / eligible.length,
    smallSampleWarning:
      eligible.length < 20
        ? `Small sample: ${eligible.length} NoVA/DC-compatible records. Treat recommendations as directional.`
        : "",
  };
}

export function breakdownBy(records = [], field) {
  const groups = new Map();
  for (const record of records) {
    const key = record[field] ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([segmentValue, segmentRecords]) => ({
    segmentType: field,
    segmentValue,
    ...computeInterviewRate(segmentRecords),
  }));
}

export function createMetricSnapshot(records = [], now = new Date()) {
  const primary = computeInterviewRate(records);
  return {
    generatedAt: now.toISOString(),
    primaryKpi: primary,
    breakdowns: {
      tier: breakdownBy(records, "tier"),
      source: breakdownBy(records, "source"),
      roleLane: breakdownBy(records, "roleLane"),
      networkingStatus: breakdownBy(records, "networkingStatus"),
      connectionStrength: breakdownBy(records, "connectionStrength"),
    },
    recommendations: primary.smallSampleWarning
      ? [{ category: "sample_size", summary: primary.smallSampleWarning, requiresApproval: true }]
      : [],
  };
}
