export const RECRUITER_STATUSES = Object.freeze([
  "Recruiter DM",
  "Needs Response",
  "Responded",
  "Follow-Up Due",
  "Interview Scheduling",
  "Rejected",
  "Offer/Comp",
  "Correction Needed",
]);

export function createRecruiterThread({ subject, company, source = "manual", tags = [], notes = "" }) {
  const normalizedTags = Array.from(new Set(["Recruiter DM", ...tags]));
  const needsResponse = normalizedTags.includes("Needs Response");
  return {
    source,
    subject,
    company,
    status: needsResponse ? "Needs Response" : "Recruiter DM",
    needsResponse,
    tags: normalizedTags,
    notes,
    lastActivityAt: new Date().toISOString(),
  };
}

export function markResponded(thread) {
  return {
    ...thread,
    status: "Responded",
    needsResponse: false,
    tags: (thread.tags ?? []).filter((tag) => tag !== "Needs Response").concat("Responded"),
    lastActivityAt: new Date().toISOString(),
  };
}

export function correctThreadTags(thread, tags) {
  const normalizedTags = Array.from(new Set(tags));
  return {
    ...thread,
    tags: normalizedTags,
    needsResponse: normalizedTags.includes("Needs Response"),
    status: normalizedTags.includes("Correction Needed")
      ? "Correction Needed"
      : normalizedTags.includes("Needs Response")
        ? "Needs Response"
        : thread.status,
  };
}
