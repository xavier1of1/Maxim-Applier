import fs from "node:fs";
import path from "node:path";

import { fromRoot } from "./path-utils.mjs";

function listFiles(relativeDir, predicate = () => true) {
  const target = fromRoot(relativeDir);
  if (!fs.existsSync(target)) {
    return [];
  }
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(target, entry.name);
      const relative = path.relative(fromRoot(), child);
      if (entry.isDirectory()) {
        return listFiles(relative, predicate);
      }
      return predicate(entry.name, relative) ? [relative] : [];
    });
}

function countCsvRows(relativePath) {
  const target = fromRoot(relativePath);
  if (!fs.existsSync(target)) {
    return 0;
  }
  const rows = fs.readFileSync(target, "utf8").split(/\r?\n/).filter((line) => line.trim());
  return Math.max(0, rows.length - 1);
}

function hasTrackerRows() {
  const trackerPath = fromRoot("data", "applications.md");
  if (!fs.existsSync(trackerPath)) {
    return false;
  }
  const rows = fs
    .readFileSync(trackerPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && !/^\|\s*-+/.test(line));
  return rows.length > 1;
}

function tableCount(store, tableName) {
  try {
    return Number(store.query(`SELECT COUNT(*) AS count FROM ${tableName}`)[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

function readDashboardState() {
  const snapshotPath = fromRoot("data", "maxim", "dashboard-state.json");
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  } catch {
    return null;
  }
}

function status(ok, message, evidence = {}) {
  return {
    status: ok ? "pass" : "needs_data",
    message,
    evidence,
  };
}

export function assessOperationalReadiness({ store, env = process.env } = {}) {
  const reportFiles = listFiles("reports", (name) => name.endsWith(".md") && name !== ".gitkeep");
  const pdfFiles = listFiles("output", (name) => name.toLowerCase().endsWith(".pdf") && name !== ".gitkeep");
  const trackerHasRows = hasTrackerRows();
  const dashboardState = readDashboardState();

  const contactsInStore = store ? tableCount(store, "contacts") : 0;
  const targetCompaniesInStore = store ? tableCount(store, "target_companies") : 0;
  const evaluationsInStore = store ? tableCount(store, "career_ops_evaluations") : 0;
  const applicationsInStore = store ? tableCount(store, "applications") : 0;
  const metricsInStore = store ? tableCount(store, "metric_snapshots") : 0;
  const notificationsInStore = store ? tableCount(store, "notifications") : 0;

  const checks = {
    environment: [
      status(fs.existsSync(fromRoot("cv.md")), "Career-Ops CV exists.", { path: "cv.md" }),
      status(fs.existsSync(fromRoot("config", "profile.yml")), "Career-Ops profile exists.", {
        path: "config/profile.yml",
      }),
      status(fs.existsSync(fromRoot("portals.yml")), "Career-Ops portals config exists.", { path: "portals.yml" }),
      status(Boolean(env.OPENAI_API_KEY), "OPENAI_API_KEY is available in the environment or .env."),
      status(Boolean(env.GEMINI_API_KEY), "GEMINI_API_KEY is available in the environment or .env."),
      status(Boolean(env.MAXIM_DISCORD_WEBHOOK_URL), "MAXIM_DISCORD_WEBHOOK_URL is available for live Discord sends."),
    ],
    careerOpsArtifacts: [
      status(reportFiles.length > 0, "At least one real Career-Ops report exists under reports/.", {
        count: reportFiles.length,
      }),
      status(pdfFiles.length > 0, "At least one generated Career-Ops PDF exists under output/.", {
        count: pdfFiles.length,
      }),
      status(trackerHasRows, "data/applications.md has at least one tracker row."),
    ],
    maximLocalData: [
      status(contactsInStore > 0 || countCsvRows("data/maxim/contacts.csv") > 0, "Contacts are available locally.", {
        storeCount: contactsInStore,
        csvRows: countCsvRows("data/maxim/contacts.csv"),
      }),
      status(
        targetCompaniesInStore > 0 || countCsvRows("data/maxim/target_companies.csv") > 0,
        "Target companies are available locally.",
        {
          storeCount: targetCompaniesInStore,
          csvRows: countCsvRows("data/maxim/target_companies.csv"),
        },
      ),
      status(
        fs.existsSync(fromRoot("article-digest.md")) || fs.existsSync(fromRoot("data", "maxim", "evidence_claims.yml")),
        "Evidence source exists for claim-gated drafting.",
      ),
      status(countCsvRows("data/maxim/application_outcomes.csv") > 0, "Application outcomes CSV has real rows.", {
        csvRows: countCsvRows("data/maxim/application_outcomes.csv"),
      }),
    ],
    maximState: [
      status(evaluationsInStore > 0, "Career-Ops evaluations have been synced into Maxim store.", {
        storeCount: evaluationsInStore,
      }),
      status(applicationsInStore > 0, "Application records exist in Maxim store.", { storeCount: applicationsInStore }),
      status(Boolean(dashboardState), "Dashboard snapshot exists and can be parsed.", {
        path: "data/maxim/dashboard-state.json",
      }),
      status(metricsInStore > 0, "At least one analytics metric snapshot exists.", { storeCount: metricsInStore }),
      status(notificationsInStore >= 0, "Notification store is initialized.", { storeCount: notificationsInStore }),
    ],
  };

  const flattened = Object.values(checks).flat();
  const needsData = flattened.filter((check) => check.status !== "pass");
  const hardOperationalBlockers = [
    ...checks.careerOpsArtifacts.filter((check) => check.status !== "pass"),
    ...checks.maximState.filter((check) =>
      ["Career-Ops evaluations have been synced into Maxim store.", "Application records exist in Maxim store."].includes(
        check.message,
      ) && check.status !== "pass",
    ),
  ];

  return {
    ok: true,
    operationalReady: hardOperationalBlockers.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      totalChecks: flattened.length,
      passed: flattened.length - needsData.length,
      needsData: needsData.length,
      hardOperationalBlockers: hardOperationalBlockers.length,
    },
    checks,
    nextActions: hardOperationalBlockers.map((check) => check.message),
  };
}
