#!/usr/bin/env node
// Offline readiness only: provider detection, never provider fetch or parser execution.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log("Usage: node maxim/scripts/audit-sources.mjs [portals.yml]\nOffline, read-only provider classification. Does not verify live coverage, fetch jobs, execute local parsers, or write tracker files.");
  process.exit(0);
}
if (args.length > 1 || args.some(arg => arg.startsWith("-"))) {
  console.error("Unknown argument. Use --help or one explicit configuration path.");
  process.exit(2);
}
const configPath = args[0] || process.env.CAREER_OPS_PORTALS || path.join(root, "portals.yml");
const config = yaml.load(fs.readFileSync(configPath, "utf8"));
if (!config || !Array.isArray(config.tracked_companies)) throw new Error("tracked_companies must be an array");
const dir = path.join(root, "providers");
const providers = new Map();
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".mjs") && !name.startsWith("_")).sort()) {
  const provider = (await import(pathToFileURL(path.join(dir, file)).href)).default;
  if (provider?.id && typeof provider.fetch === "function" && !providers.has(provider.id)) providers.set(provider.id, provider);
}
const counts = { total: config.tracked_companies.length, enabled: 0, selected: 0, unmatched: 0, invalid: 0, unknownProvider: 0, disabled: 0 };
const sources = [];
for (const entry of config.tracked_companies) {
  const source = { name: entry?.name ?? null, status: null, provider: null, reason: null };
  if (entry && typeof entry === "object" && entry.enabled === false) {
    source.status = "disabled";
    counts.disabled++;
  } else if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name.trim()) {
    source.status = "invalid";
    source.reason = "Missing or invalid company name";
    counts.invalid++;
  } else {
    counts.enabled++;
    if (entry.provider && !providers.has(entry.provider)) {
      source.status = "unknownProvider";
      source.reason = "Explicit provider is not loaded";
      counts.unknownProvider++;
    } else {
      let selected = entry.provider ? providers.get(entry.provider) : null;
      if (!selected) {
        const local = providers.get("local-parser");
        try {
          if (local?.detect?.(entry)) selected = local;
        } catch { /* A broken detector does not prevent other providers matching. */ }
        if (!selected) {
          for (const provider of providers.values()) {
            try {
              if (provider.detect?.(entry)) { selected = provider; break; }
            } catch { /* Match scanner behavior: a failed detector is skipped. */ }
          }
        }
      }
      if (selected) {
        source.status = "selected";
        source.provider = selected.id;
        source.reason = entry.provider
          ? "Explicit provider selected without detection; fetch success not verified"
          : "Provider selected; fetch success and job relevance not verified";
        if (entry.parser?.command && selected.id !== "local-parser") source.reason += "; configured local parser was not selected";
        counts.selected++;
      } else {
        source.status = "unmatched";
        source.reason = entry.scan_method === "websearch"
          ? "No provider matched; scan_method websearch is not run by scan.mjs"
          : "No provider matched";
        counts.unmatched++;
      }
    }
  }
  sources.push(source);
}
console.log(JSON.stringify({ counts, sources }, null, 2));
