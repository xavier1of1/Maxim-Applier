function includesAny(text, terms) {
  const normalized = `${text ?? ""}`.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function rankContactsForJob(job, contacts = []) {
  const company = `${job.company ?? ""}`.toLowerCase();
  const roleText = `${job.role ?? ""} ${job.title ?? ""}`.toLowerCase();
  return contacts
    .map((contact) => {
      let score = 0;
      const reasons = [];
      if (`${contact.company ?? ""}`.toLowerCase() === company && company) {
        score += 40;
        reasons.push("Same company.");
      }
      if (contact.connectionStrength) {
        score += Number(contact.connectionStrength) * 15;
        reasons.push(`Connection strength ${contact.connectionStrength}.`);
      }
      if (contact.vtAlumni || includesAny(contact.notes, ["virginia tech", "vt alumni"])) {
        score += 12;
        reasons.push("Virginia Tech signal.");
      }
      if (includesAny(contact.title, ["recruiter", "talent"])) {
        score += 10;
        reasons.push("Recruiter or talent role.");
      }
      if (includesAny(contact.title, ["founder", "co-founder"])) {
        score += 10;
        reasons.push("Founder/startup signal.");
      }
      if (includesAny(`${contact.title} ${contact.notes}`, ["software", "engineer", "automation", "federal", "cyber", "fde"]) || includesAny(roleText, ["software", "engineer", "automation", "federal", "cyber", "fde"])) {
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
