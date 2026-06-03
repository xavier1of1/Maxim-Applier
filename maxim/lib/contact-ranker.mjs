function includesAny(text, terms) {
  const normalized = `${text ?? ""}`.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function signal(value) {
  if (typeof value === "string") {
    return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

export function rankContactsForJob(job, contacts = []) {
  const company = `${job.company ?? ""}`.toLowerCase();
  const roleText = `${job.role ?? ""} ${job.title ?? ""}`.toLowerCase();
  return contacts
    .map((contact) => {
      let score = 0;
      const reasons = [];
      const connectionStrength = Number(contact.connectionStrength ?? contact.connection_strength ?? 0);
      const vtAlumni = signal(contact.vtAlumni ?? contact.vt_alumni) || includesAny(contact.notes, ["virginia tech", "vt alumni"]);
      const recruiterSignal =
        signal(contact.recruiterSignal ?? contact.recruiter_signal) ||
        includesAny(contact.title, ["recruiter", "talent"]);
      const founderSignal =
        signal(contact.founderSignal ?? contact.founder_signal) ||
        includesAny(contact.title, ["founder", "co-founder"]);
      const roleRelevance = contact.roleRelevance ?? contact.role_relevance;
      if (`${contact.company ?? ""}`.toLowerCase() === company && company) {
        score += 40;
        reasons.push("Same company.");
      }
      if (connectionStrength >= 1 && connectionStrength <= 3) {
        score += connectionStrength * 15;
        reasons.push(`Connection strength ${connectionStrength}.`);
      }
      if (vtAlumni) {
        score += 12;
        reasons.push("Virginia Tech signal.");
      }
      if (recruiterSignal) {
        score += 10;
        reasons.push("Recruiter or talent role.");
      }
      if (founderSignal) {
        score += 10;
        reasons.push("Founder/startup signal.");
      }
      if (includesAny(`${contact.title} ${contact.notes} ${roleRelevance}`, ["software", "engineer", "automation", "federal", "cyber", "fde"]) || includesAny(roleText, ["software", "engineer", "automation", "federal", "cyber", "fde"])) {
        score += 8;
        reasons.push("Role-lane relevance.");
      }
      return {
        contact,
        rankScore: score,
        rankingReason: reasons.join(" ") || "No strong ranking signal yet.",
      };
    })
    .filter((item) => item.rankScore > 0)
    .sort((a, b) => b.rankScore - a.rankScore);
}
