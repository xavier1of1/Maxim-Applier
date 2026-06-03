const REQUIRED_SECTIONS = [
  "person_research",
  "role_reference",
  "xavier_background",
  "fit_rationale",
  "call_to_action",
];

export function buildNetworkingDraft({ contact, job, research = "" }) {
  const name = contact.name ?? contact.fullName ?? "there";
  const company = job.company ?? contact.company ?? "your team";
  const role = job.role ?? job.title ?? "the role";
  const text = [
    `Person research: ${research || `I noticed your work with ${company}.`}`,
    `Role reference: I saw the ${role} opening at ${company}.`,
    "Xavier background: I am a computer science engineer from Virginia Tech with experience in full-stack software engineering, systems engineering, automation, and entrepreneurship.",
    `Fit rationale: The role appears aligned with software-building, automation, and systems work I have been doing, and your perspective on ${company} would help me understand where I could contribute.`,
    `Call to action: Would you be open to a quick conversation or pointing me toward the right person for this role?`,
  ].join("\n\n");
  return {
    channel: "linkedin_manual",
    status: "ready_to_send",
    cta: "quick conversation or referral guidance",
    draftText: `Hi ${name},\n\n${text}`,
    structure: REQUIRED_SECTIONS,
  };
}

export function validateMessageDraft(draftText) {
  const checks = {
    person_research: /person research:/i.test(draftText),
    role_reference: /role reference:/i.test(draftText),
    xavier_background: /xavier background:/i.test(draftText),
    fit_rationale: /fit rationale:/i.test(draftText),
    call_to_action: /call to action:/i.test(draftText),
    manual_only: !/send\s+linkedin|linkedin\s+send|auto[-\s]?send/i.test(draftText),
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    missing: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => key),
  };
}
