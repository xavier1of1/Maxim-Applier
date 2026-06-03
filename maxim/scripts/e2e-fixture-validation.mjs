import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { buildApplicationRecord, markSubmittedManually } from "../lib/application-tracker.mjs";
import { buildDashboardSnapshot, writeDashboardSnapshot } from "../lib/dashboard-snapshot.mjs";
import { createMetricSnapshot } from "../lib/metrics.mjs";
import { buildNetworkingDraft, validateMessageDraft } from "../lib/message-builder.mjs";
import { planNotifications, suppressDuplicateNotifications } from "../lib/notification-planner.mjs";
import { rankContactsForJob } from "../lib/contact-ranker.mjs";
import { createRecruiterThread } from "../lib/recruiter-inbox.mjs";
import { SQLiteMaximStore } from "../lib/sqlite-store.mjs";
import { syncCareerOpsArtifacts } from "../lib/tracker-sync.mjs";
import { fromRoot } from "../lib/path-utils.mjs";

function testEventLog() {
  return {
    append: (event) => ({
      event_id: crypto.randomUUID(),
      timestamp: new Date("2026-06-03T12:00:00Z").toISOString(),
      actor: "system",
      ...event,
    }),
  };
}

function copyFixtureTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-e2e-"));
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "output"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/reports/sample-report.md"),
    path.join(root, "reports", "sample-report.md"),
  );
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/output/federal-platform-labs-software-engineer.pdf"),
    path.join(root, "output", "federal-platform-labs-software-engineer.pdf"),
  );
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/data/applications.md"),
    path.join(root, "data", "applications.md"),
  );
  return root;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = copyFixtureTree();
const store = new SQLiteMaximStore({
  dbPath: path.join(root, "data", "maxim", "maxim.db"),
  eventLog: testEventLog(),
});
const now = new Date("2026-06-03T12:00:00Z");

const sync = syncCareerOpsArtifacts({ root, store, now });
const evaluation = store.query("SELECT * FROM career_ops_evaluations LIMIT 1")[0];
const job = store.query("SELECT * FROM maxim_jobs WHERE evaluation_id = ?", [evaluation.id])[0];
const flags = store.query("SELECT * FROM priority_flags WHERE job_id = ?", [job.id]);

const contacts = JSON.parse(fs.readFileSync(fromRoot("maxim/tests/fixtures/networking-contacts.json"), "utf8"));
const [topTarget] = rankContactsForJob(job, contacts);
const contact = store.upsertContact(topTarget.contact);
const networkingTarget = store.upsertNetworkingTarget({
  jobId: job.id,
  contactId: contact.id,
  rankScore: topTarget.rankScore,
  rankingReason: topTarget.rankingReason,
  status: "ready_to_research",
});
const draft = buildNetworkingDraft({
  contact,
  job,
  research: "Fixture validation: reviewed public role context and company hiring signal.",
});
const draftValidation = validateMessageDraft(draft.draftText);
const storedDraft = store.upsertMessageDraft({
  targetId: networkingTarget.id,
  jobId: job.id,
  contactId: contact.id,
  ...draft,
  validation: draftValidation,
});

const recruiterThread = store.upsertRecruiterThread(
  createRecruiterThread({
    subject: "Fixture recruiter follow-up",
    company: job.company,
    tags: ["Needs Response"],
    notes: "Fixture validation thread; reply manually.",
  }),
);

const application = store.upsertApplication(
  markSubmittedManually(
    buildApplicationRecord({
      job,
      evaluation: {
        id: evaluation.id,
        company: evaluation.company,
        role: evaluation.role,
        score: evaluation.score,
        source: evaluation.source,
        pdfPath: evaluation.pdf_path,
        reportPath: evaluation.report_path,
        jobUrl: evaluation.job_url,
      },
      priorApplications: [],
    }),
    now,
  ),
);

const records = [
  {
    ...application,
    locationText: evaluation.location_text,
    salaryText: evaluation.salary_text,
    postedAt: evaluation.posted_at,
    outcome: "Interview",
    roleLane: "software_engineering",
    networkingStatus: storedDraft.status,
    connectionStrength: contact.connectionStrength ?? contact.connection_strength,
    pdfVariant: "fixture_pdf",
    companyType: "govtech",
    recruiterInvolvement: recruiterThread.needsResponse ? "needs_response_thread" : "none",
  },
];
const metrics = createMetricSnapshot(records, now);
store.execute(
  `INSERT OR REPLACE INTO metric_snapshots (id, period_start, period_end, primary_kpi, payload_json, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
  ["metric_fixture_e2e", "2026-06-03", "2026-06-03", metrics.primaryKpi.value, JSON.stringify(metrics), now.toISOString()],
);

const dashboardOutputPath = path.join(root, "data", "maxim", "dashboard-state.json");
const { snapshot } = writeDashboardSnapshot({ store, outputPath: dashboardOutputPath, now });
const notifications = suppressDuplicateNotifications(
  planNotifications({
    jobs: store.listHighConviction(),
    messageDrafts: store.listReadyMessageDrafts(),
    recruiterThreads: store.listRecruiterNeedsResponse(),
    now,
  }),
  store.listNotificationFingerprints(),
);

assert(sync.evaluations === 1, "Expected one synced fixture evaluation");
assert(job.tier === "T3", "Expected fixture job to map to T3");
assert(flags.length >= 2, "Expected location and salary policy flags to be stored");
assert(draftValidation.valid, "Expected message draft to pass five-part validator");
assert(snapshot.todayActions.length >= 3, "Expected dashboard Today actions from job, draft, and recruiter thread");
assert(snapshot.highConvictionJobs.length >= 1, "Expected dashboard high-conviction row");
assert(snapshot.networkingQueue.length >= 1, "Expected dashboard networking row");
assert(snapshot.recruiterInbox.length >= 1, "Expected dashboard recruiter row");
assert(snapshot.applications.length >= 1, "Expected dashboard application row");
assert(metrics.primaryKpi.denominator === 1 && metrics.primaryKpi.numerator === 1, "Expected fixture interview-rate KPI");
assert(notifications.length >= 3, "Expected urgent, draft, recruiter, and/or review notifications");

console.log(
  JSON.stringify(
    {
      ok: true,
      fixtureOnly: true,
      tempRoot: root,
      input: {
        report: "maxim/tests/fixtures/reports/sample-report.md",
        pdfPathMock: "maxim/tests/fixtures/output/federal-platform-labs-software-engineer.pdf",
      },
      output: {
        careerOpsScore: evaluation.score,
        maximTier: job.tier,
        priorityFlags: flags.map((flag) => `${flag.flag_type}:${flag.severity}`),
        nextAction: job.next_action,
        networkingTarget: {
          contactName: contact.name,
          rankScore: topTarget.rankScore,
          rankingReason: topTarget.rankingReason,
        },
        draft: {
          status: storedDraft.status,
          valid: draftValidation.valid,
          structure: draft.structure,
        },
        recruiterThread: {
          status: recruiterThread.status,
          needsResponse: recruiterThread.needsResponse,
        },
        dashboard: {
          todayActions: snapshot.todayActions.length,
          highConvictionJobs: snapshot.highConvictionJobs.length,
          networkingQueue: snapshot.networkingQueue.length,
          recruiterInbox: snapshot.recruiterInbox.length,
          applications: snapshot.applications.length,
          analyticsWarning: snapshot.analytics.smallSampleWarning,
          snapshotPath: dashboardOutputPath,
        },
        analytics: {
          interviewRateNumerator: metrics.primaryKpi.numerator,
          interviewRateDenominator: metrics.primaryKpi.denominator,
          breakdowns: Object.keys(metrics.breakdowns),
        },
        notifications: notifications.map((notification) => ({
          type: notification.notificationType,
          subject: notification.subject,
          immediate: notification.immediate,
        })),
      },
    },
    null,
    2,
  ),
);
