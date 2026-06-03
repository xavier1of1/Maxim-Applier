const INTERVIEW_OUTCOMES = new Set(["interview", "interview_signal", "phone_screen", "offer"]);

function isNovaDc(record) {
  const text = `${record.locationText ?? record.location ?? record.locations ?? ""}`.toLowerCase();
  return ["northern virginia", "washington, dc", "washington dc", "arlington", "alexandria", "fairfax", "reston", "herndon", "chantilly", "tysons", "mclean", "ashburn", "manassas", "gainesville"].some((marker) => text.includes(marker));
}

function scoreBand(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return "unknown";
  }
  if (value < 3.5) {
    return "<3.5";
  }
  if (value < 4.0) {
    return "3.5-3.9";
  }
  if (value < 4.5) {
    return "4.0-4.4";
  }
  return "4.5+";
}

function salaryBand(record) {
  const text = `${record.salaryBand ?? record.salaryText ?? record.salary ?? ""}`;
  if (record.salaryBand) {
    return record.salaryBand;
  }
  const values = [...text.replace(/,/g, "").matchAll(/\$?\s*(\d+(?:\.\d+)?)(\s*k)?/gi)]
    .map((match) => {
      const raw = Number(match[1]);
      return match[2] || raw < 1000 ? Math.round(raw * 1000) : Math.round(raw);
    })
    .filter((value) => value >= 30000);
  if (values.length === 0) {
    return "unknown";
  }
  const max = Math.max(...values);
  if (max < 85000) {
    return "<85k";
  }
  if (max < 95000) {
    return "85k-94k";
  }
  if (max < 120000) {
    return "95k-119k";
  }
  return "120k+";
}

function freshnessBand(record, now = new Date()) {
  if (record.freshness) {
    return record.freshness;
  }
  if (!record.postedAt && !record.posted_at) {
    return "unknown";
  }
  const posted = new Date(record.postedAt ?? record.posted_at);
  if (Number.isNaN(posted.getTime())) {
    return "unknown";
  }
  const ageDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 2) {
    return "0-2d";
  }
  if (ageDays <= 7) {
    return "3-7d";
  }
  if (ageDays <= 21) {
    return "8-21d";
  }
  return "22d+";
}

function parseRawPayload(record) {
  if (!record.raw_payload_json) {
    return {};
  }
  try {
    return JSON.parse(record.raw_payload_json);
  } catch {
    return {};
  }
}

function enrichRecord(record, now) {
  const raw = parseRawPayload(record);
  return {
    ...raw,
    ...record,
    scoreBand: record.scoreBand ?? scoreBand(record.score ?? record.careerOpsScore ?? record.career_ops_score),
    salaryBand: salaryBand(record),
    freshness: freshnessBand(record, now),
    pdfVariant: record.pdfVariant ?? record.pdf_variant ?? raw.pdfVariant ?? (record.pdf_path || record.pdfPath ? "linked_pdf" : "unknown"),
    companyType: record.companyType ?? record.company_type ?? raw.companyType ?? "unknown",
    recruiterInvolvement:
      record.recruiterInvolvement ??
      record.recruiter_involvement ??
      raw.recruiterInvolvement ??
      (record.recruiter_thread_id ? "recruiter_thread" : "unknown"),
  };
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
  const enriched = records.map((record) => enrichRecord(record, now));
  const primary = computeInterviewRate(enriched);
  return {
    generatedAt: now.toISOString(),
    primaryKpi: primary,
    breakdowns: {
      scoreBand: breakdownBy(enriched, "scoreBand"),
      tier: breakdownBy(enriched, "tier"),
      source: breakdownBy(enriched, "source"),
      roleLane: breakdownBy(enriched, "roleLane"),
      salaryBand: breakdownBy(enriched, "salaryBand"),
      freshness: breakdownBy(enriched, "freshness"),
      networkingStatus: breakdownBy(enriched, "networkingStatus"),
      connectionStrength: breakdownBy(enriched, "connectionStrength"),
      pdfVariant: breakdownBy(enriched, "pdfVariant"),
      companyType: breakdownBy(enriched, "companyType"),
      recruiterInvolvement: breakdownBy(enriched, "recruiterInvolvement"),
    },
    recommendations: primary.smallSampleWarning
      ? [{ category: "sample_size", summary: primary.smallSampleWarning, requiresApproval: true }]
      : [],
  };
}
