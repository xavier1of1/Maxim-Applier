import fs from "node:fs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function bool(value) {
  return ["1", "true", "yes", "y"].includes(`${value ?? ""}`.trim().toLowerCase());
}

function optionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanString(value) {
  return `${value ?? ""}`
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\\u[dD][89a-fA-F][0-9a-fA-F]{2}/g, "")
    .trim();
}

function cleanRaw(raw) {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, cleanString(value)]));
}

export function parseContactsCsv(text) {
  const [header = [], ...rows] = parseCsv(text);
  const keys = header.map((key) => key.trim());
  return rows.map((row) => {
    const raw = cleanRaw(Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])));
    return {
      name: cleanString(raw.name || raw.full_name || raw.Name),
      company: cleanString(raw.company || raw.Company),
      title: cleanString(raw.title || raw.Title),
      linkedinUrl: cleanString(raw.linkedin_url || raw.linkedinUrl || raw.LinkedIn),
      email: cleanString(raw.email || raw.Email),
      connectionStrength: optionalNumber(raw.connection_strength || raw.connectionStrength),
      vtAlumni: bool(raw.vt_alumni || raw.vtAlumni),
      recruiterSignal: bool(raw.recruiter_signal || raw.recruiterSignal),
      founderSignal: bool(raw.founder_signal || raw.founderSignal),
      roleRelevance: cleanString(raw.role_relevance || raw.roleRelevance),
      source: cleanString(raw.source || "contacts_csv"),
      notes: cleanString(raw.notes || ""),
      rawPayload: raw,
    };
  });
}

export function importContactsCsv(filePath, store) {
  const contacts = parseContactsCsv(fs.readFileSync(filePath, "utf8"));
  let imported = 0;
  for (const contact of contacts) {
    if (!contact.name) {
      continue;
    }
    store.upsertContact(contact);
    imported += 1;
  }
  return {
    sourcePath: filePath,
    parsed: contacts.length,
    imported,
    skipped: contacts.length - imported,
    signalCounts: {
      connectionStrength: contacts.filter((contact) => contact.connectionStrength >= 1).length,
      vtAlumni: contacts.filter((contact) => contact.vtAlumni).length,
      recruiterSignal: contacts.filter((contact) => contact.recruiterSignal).length,
      founderSignal: contacts.filter((contact) => contact.founderSignal).length,
    },
  };
}
