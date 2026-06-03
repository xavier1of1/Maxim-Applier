function normalize(value) {
  return `${value ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectDuplicateRisk(newApplication, priorApplications = []) {
  const matches = priorApplications.filter((prior) => {
    const sameCompany = normalize(prior.company) === normalize(newApplication.company);
    const sameUrl = prior.jobUrl && newApplication.jobUrl && prior.jobUrl === newApplication.jobUrl;
    const sameJobId = prior.jobId && newApplication.jobId && prior.jobId === newApplication.jobId;
    const similarRole = normalize(prior.role) === normalize(newApplication.role);
    return sameUrl || sameJobId || (sameCompany && similarRole);
  });
  if (matches.length === 0) {
    return { duplicateRisk: "low", action: "allow", matches: [], warning: "" };
  }
  const differentJobId =
    newApplication.jobId && matches.every((match) => match.jobId && match.jobId !== newApplication.jobId);
  if (differentJobId) {
    return {
      duplicateRisk: "medium",
      action: "allow_with_duplicate_warning",
      matches,
      warning: "Same company has prior applications, but this appears to be a different job ID.",
    };
  }
  return {
    duplicateRisk: "high",
    action: "hold_for_review",
    matches,
    warning: "Possible duplicate application. Review before submitting manually.",
  };
}
