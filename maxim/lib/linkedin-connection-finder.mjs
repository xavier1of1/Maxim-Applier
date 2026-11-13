import { rankContactsForJob } from "./contact-ranker.mjs";
import { stableId } from "./sqlite-store.mjs";

const ROLE_LANE_KEYWORDS = [
  "software",
  "engineer",
  "full stack",
  "full-stack",
  "backend",
  "frontend",
  "automation",
  "systems",
  "federal",
  "govcon",
  "cyber",
  "mission",
  "platform",
  "data",
  "ai",
  "ml",
  "fde",
];

const LOCATION_TERMS = [
  "Northern Virginia",
  "Washington DC",
  "Arlington",
  "Reston",
  "Tysons",
  "Herndon",
  "Chantilly",
  "Manassas",
  "Gainesville",
];

function clean(value) {
  return `${value ?? ""}`
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, terms) {
  const normalized = clean(text).toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function encodeQuery(query) {
  return encodeURIComponent(query.replace(/\s+/g, " ").trim());
}

function searchUrl(query) {
  return `https://www.google.com/search?q=${encodeQuery(query)}`;
}

function linkedinPeopleUrl(keywords) {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeQuery(keywords)}`;
}

function companyDomain(company) {
  return clean(company)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function inferRoleLane(role = "") {
  const roleText = clean(role).toLowerCase();
  const matched = ROLE_LANE_KEYWORDS.filter((term) => roleText.includes(term));
  if (roleText.includes("forward deployed") && !matched.includes("fde")) {
    matched.push("fde");
  }
  if (matched.length > 0) {
    return [...new Set(matched)].slice(0, 5);
  }
  return ["software", "engineer", "automation"];
}

export function buildLinkedInSearchTasks(job = {}) {
  const company = clean(job.company);
  const role = clean(job.role ?? job.title);
  const lane = inferRoleLane(role);
  const companyQuoted = company ? `"${company}"` : "";
  const roleQuoted = role ? `"${role}"` : lane.map((term) => `"${term}"`).join(" ");
  const localTerms = LOCATION_TERMS.map((term) => `"${term}"`).join(" OR ");
  const tasks = [
    {
      type: "recruiter",
      priority: 1,
      purpose: "Find talent/recruiting contacts associated with the company.",
      query: `site:linkedin.com/in ${companyQuoted} ("recruiter" OR "talent acquisition" OR "sourcer") (${localTerms})`,
      linkedinKeywords: `${company} recruiter talent acquisition`,
    },
    {
      type: "hiring_manager",
      priority: 2,
      purpose: "Find engineering leaders who may own the role or adjacent team.",
      query: `site:linkedin.com/in ${companyQuoted} ("engineering manager" OR "director engineering" OR "head of engineering" OR "software engineering manager") ${roleQuoted}`,
      linkedinKeywords: `${company} engineering manager ${lane.join(" ")}`,
    },
    {
      type: "team_peer",
      priority: 3,
      purpose: "Find likely team peers who can provide role/team context.",
      query: `site:linkedin.com/in ${companyQuoted} (${lane.map((term) => `"${term}"`).join(" OR ")}) ("engineer" OR "developer")`,
      linkedinKeywords: `${company} ${lane.join(" ")} engineer`,
    },
    {
      type: "vt_alumni",
      priority: 4,
      purpose: "Find Virginia Tech alumni at the company for warm relationship context.",
      query: `site:linkedin.com/in ${companyQuoted} ("Virginia Tech" OR "Virginia Polytechnic" OR "VT") ${roleQuoted}`,
      linkedinKeywords: `${company} Virginia Tech ${lane.join(" ")}`,
    },
    {
      type: "founder_startup",
      priority: 5,
      purpose: "Find founder/startup leaders where a direct note may be high leverage.",
      query: `site:linkedin.com/in ${companyQuoted} ("founder" OR "co-founder" OR "founding engineer") ${roleQuoted}`,
      linkedinKeywords: `${company} founder ${lane.join(" ")}`,
    },
  ];
  return tasks.map((task) => ({
    ...task,
    publicSearchUrl: searchUrl(task.query),
    linkedinPeopleSearchUrl: linkedinPeopleUrl(task.linkedinKeywords),
    manualOnly: true,
  }));
}

function extractLinkedInUrl(text) {
  return clean(text).match(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/in\/[A-Za-z0-9%._~\-]+\/?/i)?.[0] ?? "";
}

function inferCompanyFromTitle(title) {
  const cleaned = clean(title);
  const atMatch = cleaned.match(/\b(?:at|@)\s+([^|,;]+)/i);
  return clean(atMatch?.[1] ?? "");
}

function inferConnectionStrength(block) {
  const text = clean(block).toLowerCase();
  if (/\b1st\b|\bconnected\b|\bconnection\b/.test(text)) {
    return 1;
  }
  if (/\b2nd\b|\bsecond\b/.test(text)) {
    return undefined;
  }
  return undefined;
}

function isNoiseLine(line) {
  return /^(message|connect|follow|view profile|people|jobs|posts|see all|linkedin|sponsored|promoted)$/i.test(clean(line));
}

export function parseLinkedInPeopleText(text, { source = "linkedin_pasted_results" } = {}) {
  const normalized = `${text ?? ""}`.replace(/\r/g, "");
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const contacts = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map(clean)
      .filter((line) => line && !isNoiseLine(line));
    if (lines.length === 0) {
      continue;
    }
    const linkedinUrl = extractLinkedInUrl(block);
    const nonUrlLines = lines.filter((line) => !/^https?:\/\//i.test(line));
    const name = nonUrlLines.find((line) => !/[|•]/.test(line) && line.length <= 80) ?? nonUrlLines[0];
    const title =
      nonUrlLines.find((line) => line !== name && (/\bat\b|\b@\b|\bengineer\b|\brecruiter\b|\bfounder\b|\btalent\b/i.test(line))) ??
      nonUrlLines.find((line) => line !== name) ??
      "";
    const company = inferCompanyFromTitle(title);
    const raw = { block, lines, source };
    if (!name || name.length < 2) {
      continue;
    }
    contacts.push({
      id: stableId("contact", `${name}|${company}|${linkedinUrl}`),
      name,
      company,
      title,
      linkedinUrl,
      connectionStrength: inferConnectionStrength(block),
      vtAlumni: includesAny(block, ["Virginia Tech", "Virginia Polytechnic", "VT alum"]),
      recruiterSignal: includesAny(title, ["recruiter", "talent", "sourcer"]),
      founderSignal: includesAny(title, ["founder", "co-founder", "founding"]),
      roleRelevance: includesAny(title, ROLE_LANE_KEYWORDS) ? title : "",
      source,
      notes: "Parsed from pasted LinkedIn/public people-search results. Manual verification required.",
      rawPayload: raw,
    });
  }
  const seen = new Set();
  return contacts.filter((contact) => {
    const key = `${contact.linkedinUrl || contact.name}|${contact.company}|${contact.title}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function contactMatchesCompany(contact, company) {
  const expected = companyDomain(company);
  if (!expected) {
    return false;
  }
  const haystack = companyDomain(`${contact.company ?? ""} ${contact.title ?? ""} ${contact.notes ?? ""}`);
  if (!haystack) {
    return false;
  }
  return haystack.includes(expected) || expected.includes(haystack);
}

export function buildLinkedInConnectionDiscovery({
  job,
  contacts = [],
  pastedText = "",
  limit = 8,
  includeSearchTasks = true,
} = {}) {
  const parsedContacts = parseLinkedInPeopleText(pastedText);
  const allContacts = [...contacts, ...parsedContacts];
  const ranked = rankContactsForJob(job, allContacts).slice(0, limit);
  const sameCompanyContacts = allContacts
    .filter((contact) => contactMatchesCompany(contact, job?.company))
    .slice(0, limit)
    .map((contact) => ({
      contact,
      matchReason: "Company/name signal matched the target role company.",
    }));
  return {
    ok: true,
    job: {
      id: job?.id ?? job?.jobId ?? null,
      company: clean(job?.company),
      role: clean(job?.role ?? job?.title),
      roleLane: inferRoleLane(job?.role ?? job?.title),
    },
    parsedContacts,
    localMatches: sameCompanyContacts,
    rankedCandidates: ranked.map((item) => ({
      contact: item.contact,
      rankScore: item.rankScore,
      rankingReason: item.rankingReason,
    })),
    searchTasks: includeSearchTasks ? buildLinkedInSearchTasks(job) : [],
    safety: {
      linkedinLoginRequired: false,
      linkedinSending: "not_implemented",
      scraping: "not_implemented",
      manualReviewRequired: true,
    },
  };
}
