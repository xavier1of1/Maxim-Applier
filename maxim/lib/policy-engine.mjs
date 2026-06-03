export const DEFAULT_MAXIM_POLICY = Object.freeze({
  location: {
    allowedPrimary: [
      "northern virginia",
      "washington, dc",
      "washington dc",
      "dc",
      "arlington",
      "alexandria",
      "fairfax",
      "reston",
      "herndon",
      "chantilly",
      "tysons",
      "mclean",
      "ashburn",
      "manassas",
      "gainesville",
    ],
    excludedByDefault: ["maryland", "bethesda", "rockville", ", md", " md"],
  },
  salary: {
    globalMinimum: 85000,
    t3FlatMinimum: 90000,
    rangeMinimumFloor: 80000,
    rangeMaximumRequired: 95000,
    expectedSalaryDefault: 100000,
    expectedSalaryHighFit: 110000,
    textAnswer: "Negotiable based on role scope and total compensation.",
  },
  clearance: {
    usCitizen: true,
    activeClearance: false,
    willingToObtain: true,
  },
  notifications: {
    urgentFreshnessHours: 48,
  },
});

function flag(flagType, severity, reason) {
  return { flagType, severity, reason };
}

export function parseSalaryText(text = "") {
  const normalized = `${text}`.replace(/,/g, "").toLowerCase();
  const matches = [...normalized.matchAll(/\$?\s*(\d+(?:\.\d+)?)(\s*k)?/g)].map((match) => {
    const raw = Number(match[1]);
    return match[2] || raw < 1000 ? Math.round(raw * 1000) : Math.round(raw);
  });
  if (matches.length === 0) {
    return {};
  }
  const values = matches.filter((value) => value >= 30000);
  if (values.length === 1) {
    return { salaryFlat: values[0] };
  }
  return { salaryMin: Math.min(...values), salaryMax: Math.max(...values) };
}

function splitLocations(locationText = "") {
  if (Array.isArray(locationText)) {
    return locationText;
  }
  return `${locationText}`
    .split(/[;|/]/)
    .flatMap((part) => part.split(/\bor\b/i))
    .map((part) => part.trim())
    .filter(Boolean);
}

export class MaximPolicyEngine {
  constructor(policy = DEFAULT_MAXIM_POLICY) {
    this.policy = policy;
  }

  evaluate(job, { tier = undefined, now = new Date() } = {}) {
    const flags = [
      ...this.evaluateLocation(job),
      ...this.evaluateSalary(job, tier),
      ...this.evaluateClearance(job),
      ...this.evaluateFreshness(job, tier, now),
      ...this.evaluateConnection(job),
      ...this.evaluateCaution(job),
    ];
    const allowed = !flags.some((item) => item.severity === "blocker");
    return {
      allowed,
      flags,
      nextReviewRequired: flags.some((item) => ["review", "blocker"].includes(item.severity)),
      explanation: flags.map((item) => item.reason),
    };
  }

  evaluateLocation(job) {
    const locations = splitLocations(job.locationText ?? job.locations ?? "");
    if (locations.length === 0) {
      return [flag("location", "review", "Location missing; queue for review.")];
    }
    let hasAllowed = false;
    let hasMarylandOnlySignal = false;
    for (const location of locations) {
      const normalized = location.toLowerCase();
      if (this.policy.location.allowedPrimary.some((marker) => normalized.includes(marker))) {
        hasAllowed = true;
      }
      if (this.policy.location.excludedByDefault.some((marker) => normalized.includes(marker))) {
        hasMarylandOnlySignal = true;
      }
    }
    if (hasAllowed) {
      return [flag("location", "positive", "At least one location is NoVA/DC-compatible.")];
    }
    if (hasMarylandOnlySignal) {
      return [flag("location", "blocker", "Maryland-only roles are excluded by default.")];
    }
    if (locations.some((location) => location.toLowerCase().includes("remote"))) {
      return [flag("location", "review", "Remote role requires strong-fit review.")];
    }
    return [flag("location", "blocker", "Location is outside NoVA/DC policy.")];
  }

  evaluateSalary(job, tier) {
    const salary =
      job.salaryFlat || job.salaryMin || job.salaryMax
        ? job
        : parseSalaryText(job.salaryText ?? "");
    const salaryFlat = job.salaryFlat ?? salary.salaryFlat;
    const salaryMin = job.salaryMin ?? salary.salaryMin;
    const salaryMax = job.salaryMax ?? salary.salaryMax;
    const highConviction = tier === "T3";
    const hardMinimum = highConviction
      ? this.policy.salary.t3FlatMinimum
      : this.policy.salary.globalMinimum;

    if (!salaryFlat && !salaryMin && !salaryMax) {
      return [flag("salary", "review", "Salary missing; do not auto-reject, but queue for review.")];
    }
    if (salaryFlat) {
      if (salaryFlat < hardMinimum) {
        return [flag("salary", "blocker", `Flat salary is below the hard minimum of ${hardMinimum}.`)];
      }
      return [flag("salary", "positive", "Flat salary satisfies the configured minimum.")];
    }
    if (salaryMin && salaryMax) {
      const rangeSupportsTarget =
        salaryMax >= this.policy.salary.rangeMaximumRequired &&
        salaryMin >= this.policy.salary.rangeMinimumFloor &&
        (salaryMin >= this.policy.salary.t3FlatMinimum ||
          (salaryMin <= this.policy.salary.t3FlatMinimum && salaryMax >= this.policy.salary.t3FlatMinimum));
      if (
        rangeSupportsTarget
      ) {
        return [flag("salary", "positive", "Salary range supports the target compensation policy.")];
      }
      if (salaryMax < this.policy.salary.globalMinimum) {
        return [flag("salary", "blocker", "Salary range max is below the global hard minimum.")];
      }
      return [flag("salary", "review", "Salary range is ambiguous against Maxim policy.")];
    }
    const singleValue = salaryMax ?? salaryMin;
    if (singleValue < hardMinimum) {
      return [flag("salary", "blocker", `Salary is below the hard minimum of ${hardMinimum}.`)];
    }
    return [flag("salary", "positive", "Salary signal satisfies the configured minimum.")];
  }

  evaluateClearance(job) {
    const text = `${job.clearanceText ?? ""} ${job.description ?? ""}`.toLowerCase();
    if (/active\s+(secret|top secret|ts\/sci|clearance)/.test(text) && !/willing|eligible|obtain|sponsor/.test(text)) {
      return [flag("clearance", "blocker", "Role appears to require active clearance; Xavier must not claim active clearance.")];
    }
    if (/clearance/.test(text)) {
      return [flag("clearance", "review", "Clearance language present; answer only eligible/willing to obtain.")];
    }
    return [];
  }

  evaluateFreshness(job, tier, now) {
    if (!job.postedAt) {
      return [];
    }
    const posted = new Date(job.postedAt);
    if (Number.isNaN(posted.getTime())) {
      return [flag("freshness", "review", "Posted date is unparseable.")];
    }
    const ageHours = (now.getTime() - posted.getTime()) / (1000 * 60 * 60);
    if (["T2", "T3"].includes(tier) && ageHours <= this.policy.notifications.urgentFreshnessHours) {
      return [flag("fresh", "urgent", "Fresh T2+ role should get immediate attention.")];
    }
    return [];
  }

  evaluateConnection(job) {
    if (job.connectionStrength >= 1 || job.vtAlumni || job.recruiterSignal || job.founderSignal) {
      return [
        flag(
          "connection_overlay",
          "positive",
          "Connection, VT alumni, recruiter, founder, or target-company signal adds priority overlay.",
        ),
      ];
    }
    return [];
  }

  evaluateCaution(job) {
    const haystack = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();
    const hardRejects = ["help desk", "desktop support", "unpaid", "active directory administrator"];
    const match = hardRejects.find((term) => haystack.includes(term));
    return match ? [flag("caution", "blocker", `Role matches hard-reject category: ${match}.`)] : [];
  }
}

export function expectedSalaryAnswer({ salaryText, tier, textAllowed = false } = {}) {
  if (textAllowed) {
    return DEFAULT_MAXIM_POLICY.salary.textAnswer;
  }
  const parsed = parseSalaryText(salaryText);
  if (parsed.salaryMin && parsed.salaryMax) {
    const median = Math.round((parsed.salaryMin + parsed.salaryMax) / 2);
    if (tier === "T3" && parsed.salaryMax >= DEFAULT_MAXIM_POLICY.salary.expectedSalaryHighFit) {
      return String(DEFAULT_MAXIM_POLICY.salary.expectedSalaryHighFit);
    }
    return String(Math.max(DEFAULT_MAXIM_POLICY.salary.expectedSalaryDefault, median));
  }
  if (parsed.salaryFlat) {
    return String(Math.max(DEFAULT_MAXIM_POLICY.salary.expectedSalaryDefault, parsed.salaryFlat));
  }
  return "queue_for_review";
}
