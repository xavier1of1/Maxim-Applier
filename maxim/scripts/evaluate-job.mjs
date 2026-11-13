import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { parseReportFile } from "../lib/careerops-parser.mjs";
import { fromRoot } from "../lib/path-utils.mjs";

function usage() {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message: "Usage: npm run maxim:evaluate-job -- <job-url-or-jd-file>",
        examples: [
          "npm run maxim:evaluate-job -- https://jobs.lever.co/company/job-id",
          "npm run maxim:evaluate-job -- jds\\my-job-description.txt",
        ],
      },
      null,
      2,
    ),
  );
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

function slug(value) {
  return String(value ?? "job")
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "job";
}

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/\r/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

async function materializeInput(input) {
  if (!isUrl(input)) {
    const filePath = path.resolve(input);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Job description file not found: ${input}`);
    }
    return { jdPath: filePath, source: "file" };
  }

  const response = await fetch(input, {
    headers: {
      "user-agent": "Maxim Apply Career-Ops local evaluator; contact: local-user",
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch job URL (${response.status} ${response.statusText}): ${input}`);
  }
  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? slug(input);
  const text = htmlToText(html);
  if (text.length < 500) {
    throw new Error("Fetched page did not contain enough readable job-description text. Paste the JD into jds\\*.txt and rerun.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const jdPath = fromRoot("jds", `${slug(title)}-${today}.txt`);
  fs.mkdirSync(path.dirname(jdPath), { recursive: true });
  fs.writeFileSync(jdPath, `Source URL: ${input}\nFetched: ${today}\n\n${text}\n`, "utf8");
  return { jdPath, source: "url", fetchedCharacters: text.length };
}

function run(command, args, options = {}) {
  const isNpm = command === "npm";
  const result = spawnSync(command, args, {
    cwd: fromRoot(),
    encoding: "utf8",
    shell: isNpm && process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result;
}

function newestReport(beforeMs) {
  const reportsDir = fromRoot("reports");
  const reports = fs
    .readdirSync(reportsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const fullPath = path.join(reportsDir, name);
      return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .filter((item) => item.mtimeMs >= beforeMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return reports[0];
}

function extractReportNumber(reportName) {
  return reportName.match(/^(\d+)/)?.[1] ?? "000";
}

function pdfFlag(reportPath) {
  const text = fs.readFileSync(reportPath, "utf8");
  const pdf = text.match(/^\s*\*\*PDF:\*\*\s*(.+)$/im)?.[1]?.trim();
  return pdf && !/^pending$/i.test(pdf) ? "✅" : "❌";
}

function addTrackerRow(report) {
  const parsed = parseReportFile(report.fullPath);
  const invalid =
    !parsed.company ||
    !parsed.role ||
    parsed.company.toLowerCase() === "unknown" ||
    parsed.role.toLowerCase() === "unknown" ||
    !Number.isFinite(parsed.score);
  if (invalid) {
    fs.unlinkSync(report.fullPath);
    throw new Error(
      `Generated report was not parseable enough to merge safely (${report.name}). ` +
        "No tracker row was written. Try rerunning, or paste a cleaner JD with title/company/salary/location.",
    );
  }
  const reportNum = extractReportNumber(report.name);
  const today = new Date().toISOString().slice(0, 10);
  const score = Number.isFinite(parsed.score) ? `${parsed.score}/5` : "N/A";
  const tsvPath = fromRoot("batch", "tracker-additions", `${reportNum}-${slug(parsed.company)}.tsv`);
  fs.mkdirSync(path.dirname(tsvPath), { recursive: true });
  fs.writeFileSync(
    tsvPath,
    [
      reportNum,
      today,
      parsed.company ?? "Unknown",
      parsed.role ?? "Unknown",
      "Evaluated",
      score,
      pdfFlag(report.fullPath),
      `[${reportNum}](reports/${report.name})`,
      "Generated by maxim:evaluate-job. Xavier reviews and submits manually.",
    ].join("\t"),
    "utf8",
  );
  return { tsvPath, parsed };
}

const input = process.argv[2];
if (!input || ["--help", "-h"].includes(input)) {
  usage();
  process.exit(input ? 0 : 1);
}

try {
  const materialized = await materializeInput(input);
  const beforeMs = Date.now() - 1000;
  const evalResult = run(process.execPath, ["gemini-eval.mjs", "--file", materialized.jdPath]);
  const report = newestReport(beforeMs);
  if (!report) {
    throw new Error("Gemini evaluation completed but no new report was found under reports/.");
  }
  const tracker = addTrackerRow(report);
  const mergeResult = run(process.execPath, ["merge-tracker.mjs", "--verify"]);
  const syncResult = run("npm", ["run", "maxim:sync"]);
  const applyWorkflowResult = run("npm", ["run", "maxim:apply-workflow"]);
  const analyticsResult = run("npm", ["run", "maxim:analytics"]);
  const dashboardResult = run("npm", ["run", "maxim:dashboard-state"]);
  const operationalResult = run("npm", ["run", "maxim:operational"]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        input: materialized,
        report: path.relative(fromRoot(), report.fullPath),
        trackerAddition: path.relative(fromRoot(), tracker.tsvPath),
        company: tracker.parsed.company,
        role: tracker.parsed.role,
        score: tracker.parsed.score,
        commands: {
          geminiEval: evalResult.status,
          merge: mergeResult.status,
          sync: syncResult.status,
          applyWorkflow: applyWorkflowResult.status,
          analytics: analyticsResult.status,
          dashboardState: dashboardResult.status,
          operational: operationalResult.status,
        },
        note: "No application was submitted and no outreach was sent.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
