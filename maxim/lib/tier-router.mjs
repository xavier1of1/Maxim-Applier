export const TIERS = Object.freeze({
  T0: "T0",
  T1: "T1",
  T2: "T2",
  T3: "T3",
});

export function assignTier(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return {
      tier: TIERS.T1,
      explanation: "Career-Ops score missing or unparseable; queue for strategic review.",
      nextAction: "queue_review",
    };
  }
  if (numericScore < 3.5) {
    return {
      tier: TIERS.T0,
      explanation: `Career-Ops score ${numericScore} is below 3.5.`,
      nextAction: "no_apply",
    };
  }
  if (numericScore < 4.0) {
    return {
      tier: TIERS.T1,
      explanation: `Career-Ops score ${numericScore} is 3.5-3.9.`,
      nextAction: "strategic_override_only",
    };
  }
  if (numericScore < 4.5) {
    return {
      tier: TIERS.T2,
      explanation: `Career-Ops score ${numericScore} is 4.0-4.4.`,
      nextAction: "prepare_application_packet",
    };
  }
  return {
    tier: TIERS.T3,
    explanation: `Career-Ops score ${numericScore} is 4.5 or above.`,
    nextAction: "urgent_high_conviction_action",
  };
}

export function chooseNextAction({ tier, flags = [] }) {
  const hasBlocker = flags.some((flag) => flag.severity === "blocker");
  if (hasBlocker) {
    return "no_apply_or_manual_override";
  }
  if (flags.some((flag) => flag.flagType === "needs_review")) {
    return "queue_review";
  }
  if (flags.some((flag) => flag.flagType === "connection_overlay")) {
    return "build_networking_shortlist";
  }
  if (tier === TIERS.T3) {
    return "urgent_high_conviction_action";
  }
  if (tier === TIERS.T2) {
    return "prepare_application_packet";
  }
  if (tier === TIERS.T1) {
    return "strategic_override_only";
  }
  return "no_apply";
}

export function routeEvaluation(evaluation, flags = []) {
  const tierDecision = assignTier(evaluation.score);
  const priorityOverlay = flags.some((flag) =>
    ["connection_overlay", "fresh", "target_company", "recruiter_signal"].includes(flag.flagType),
  );
  const nextAction = chooseNextAction({ tier: tierDecision.tier, flags });
  return {
    tier: tierDecision.tier,
    nextAction,
    priorityOverlay,
    explanation: [tierDecision.explanation, ...flags.map((flag) => flag.reason)].join(" "),
  };
}
