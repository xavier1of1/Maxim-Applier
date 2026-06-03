import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fromRoot } from "../lib/path-utils.mjs";

const scannedRoots = ["maxim", "workers", "backend/app", "scripts"];
const prohibited = [
  { code: "linkedin_send", pattern: /\b(sendLinkedIn|linkedinSend|send_linkedin|linkedin_message_sender|postToLinkedIn|linkedin_api.{0,40}send)\b/i },
  { code: "auto_submit", pattern: /\b(auto[-_\s]?submit|submit\s*\(\)|click\s*\(\s*['"]submit)/i },
  { code: "captcha_bypass", pattern: /\b(captcha).{0,80}\b(bypass|solve|solver|token)/i },
  { code: "anti_bot_evasion", pattern: /\b(stealth|undetected|fingerprint\s*spoof|proxy\s*rotation|user-agent\s*rotation)\b/i },
];

function listFiles(root) {
  const absolute = fromRoot(root);
  if (!fs.existsSync(absolute)) {
    return [];
  }
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".venv", "__pycache__"].includes(entry.name)) {
        return [];
      }
      return listFiles(path.relative(fromRoot(), child));
    }
    return /\.(mjs|js|ts|tsx|py|md|yml|yaml)$/i.test(entry.name) ? [child] : [];
  });
}

export function runSafetyCheck() {
  const findings = [];
  for (const file of scannedRoots.flatMap(listFiles)) {
    const relative = path.relative(fromRoot(), file);
    const text = fs.readFileSync(file, "utf8");
    for (const check of prohibited) {
      if (check.pattern.test(text)) {
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
    scannedRoots,
    message:
      findings.length === 0
        ? "No prohibited LinkedIn sending, auto-submit, CAPTCHA bypass, or anti-bot evasion patterns found."
        : "Safety check failed; remove prohibited automation patterns.",
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = runSafetyCheck();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
