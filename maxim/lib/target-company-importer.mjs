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

function cleanString(value) {
  return `${value ?? ""}`
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\\u[dD][89a-fA-F][0-9a-fA-F]{2}/g, "")
    .trim();
}

function optionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanRaw(raw) {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, cleanString(value)]));
}

export function parseTargetCompaniesCsv(text) {
  const [header = [], ...rows] = parseCsv(text);
  const keys = header.map((key) => key.trim());
  return rows.map((row) => {
    const raw = cleanRaw(Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])));
    return {
      company: cleanString(raw.company || raw.Company || raw.name || raw.Name),
      priority: cleanString(raw.priority || raw.Priority),
      sourcePreference: cleanString(raw.source_preference || raw.sourcePreference),
      connectionStrength: optionalNumber(raw.connection_strength || raw.connectionStrength),
      locationFocus: cleanString(raw.location_focus || raw.locationFocus),
      roleLanes: cleanString(raw.role_lanes || raw.roleLanes),
      notes: cleanString(raw.notes || ""),
      rawPayload: raw,
    };
  });
}

export function importTargetCompaniesCsv(filePath, store) {
  const targetCompanies = parseTargetCompaniesCsv(fs.readFileSync(filePath, "utf8"));
  let imported = 0;
  for (const targetCompany of targetCompanies) {
    if (!targetCompany.company) {
      continue;
    }
    store.upsertTargetCompany(targetCompany);
    imported += 1;
  }
  return {
    sourcePath: filePath,
    parsed: targetCompanies.length,
    imported,
    skipped: targetCompanies.length - imported,
    signalCounts: {
      highPriority: targetCompanies.filter((item) => item.priority.toLowerCase() === "high").length,
      connectionStrength: targetCompanies.filter((item) => item.connectionStrength >= 1).length,
      locationFocus: targetCompanies.filter((item) => item.locationFocus).length,
      roleLanes: targetCompanies.filter((item) => item.roleLanes).length,
    },
  };
}
