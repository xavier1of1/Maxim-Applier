import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {createHash} from 'node:crypto';
import {verifyBundle} from '../upstream-discovery/catalog.mjs';

import { fromRoot } from "../lib/path-utils.mjs";

const scannedRoots = ["maxim", "workers", "backend/app", "scripts"];
const prohibited = [
  { code: "linkedin_send", pattern: /\b(sendLinkedIn|linkedinSend|send_linkedin|linkedin_message_sender|postToLinkedIn|linkedin_api.{0,40}send)\b/i },
  { code: "auto_submit", pattern: /\b(auto[-_\s]?submit|submit\s*\(\)|click\s*\(\s*['"]submit)/i },
  { code: "captcha_bypass", pattern: /\b(captcha).{0,80}\b(bypass|solve|solver|token)/i },
  { code: "anti_bot_evasion", pattern: /\b(stealth|undetected|fingerprint\s*spoof|proxy\s*rotation|user-agent\s*rotation)\b/i },
  { code: "unbounded_retry_loop", pattern: /\b(while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\))/i },
  { code: "high_frequency_polling", pattern: /\b(setInterval\s*\(|requestAnimationFrame\s*\()/i },
];

function listFiles(root) {
  const absolute = fromRoot(root);
  if (!fs.existsSync(absolute)) {
    return [];
  }
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".venv", "__pycache__", ".next", "test-results", "playwright-report"].includes(entry.name)) {
        return [];
      }
      return listFiles(path.relative(fromRoot(), child));
    }
    return /\.(mjs|js|ts|tsx|py|md|yml|yaml)$/i.test(entry.name) ? [child] : [];
  });
}

export function runSafetyCheck() {
  const findings = [];
  const reviewed=[];
  const audit=JSON.parse(fs.readFileSync(fromRoot('maxim/upstream-discovery/safety-review.json'),'utf8'));
  try{if(audit.commit!=='194933aa111aa4f2fd3ffa69048347fa6a974d27')throw Error('Unreviewed source version');verifyBundle();}catch{findings.push({file:'maxim/vendor/career-ops-discovery',code:'pinned_source_integrity'});}
  for (const file of scannedRoots.flatMap(listFiles)) {
    const relative = path.relative(fromRoot(), file);
    const text = fs.readFileSync(file, "utf8");
    for (const check of prohibited) {
      if (check.pattern.test(text)) {
        const normalized=relative.replaceAll('\\','/'),prefix='maxim/vendor/career-ops-discovery/',exception=normalized.startsWith(prefix)?audit.files[normalized.slice(prefix.length)]:null;
        if(exception?.code===check.code&&createHash('sha256').update(text).digest('hex')===exception.sha256){reviewed.push({file:relative,code:check.code,reason:exception.reason});continue;}
        if (relative.includes("website-safety-check") || relative.includes("no-anti-bot")) {
          continue;
        }
        findings.push({ file: relative, code: check.code });
      }
    }
  }
  return {
    ok: findings.length === 0,
    findings,
    reviewedPinnedFindings:reviewed,
    scannedRoots,
    message:
      findings.length === 0
        ? "No prohibited LinkedIn sending, auto-submit, CAPTCHA bypass, anti-bot evasion, unbounded retry, or high-frequency polling patterns found."
        : "Safety check failed; remove prohibited automation or unbounded retry/polling patterns.",
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = runSafetyCheck();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
