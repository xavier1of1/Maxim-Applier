import fs from "node:fs";
import path from "node:path";

import { createStore } from "./sqlite-store.mjs";
import { fromRoot } from "./path-utils.mjs";

function splitFlags(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jobDTO(row) {
  return {
    id: row.id,
    company: row.company ?? "",
    role: row.role ?? "",
    score: row.career_ops_score ?? row.score ?? 0,
    tier: row.tier ?? "",
    nextAction: row.next_action ?? row.nextAction ?? "",
    flags: splitFlags(row.flags),
  };
}

function todayJobAction(row) {
  const job = jobDTO(row);
  return {
    actionType: "job",
    title: `${job.company} - ${job.role}`,
    detail: job.nextAction || "Review Maxim next action.",
    status: job.tier,
    job,
  };
}

function readyDraftAction(row) {
  return {
    actionType: "message_draft",
    title: `Networking draft ready${row.contact_id ? ` for ${row.contact_id}` : ""}`,
    detail: "Review and send manually. No LinkedIn automation is used.",
    status: row.status,
    job: {
      id: row.job_id ?? "",
      company: "",
      role: "",
      score: 0,
      tier: "",
      nextAction: "manual_send_review",
      flags: ["manual-only"],
    },
  };
}

function recruiterAction(row) {
  return {
    actionType: "recruiter_response",
    title: row.subject ?? "Recruiter thread",
    detail: "Reply manually, then mark the thread responded.",
    status: row.status ?? "Needs Response",
    job: {
      id: row.id ?? "",
      company: row.company ?? "",
      role: "Recruiter Thread",
      score: 0,
      tier: "",
      nextAction: "manual_response",
      flags: ["needs-response"],
    },
  };
}

function networkingDTO(row) {
  const title = row.job_company && row.job_role
    ? `${row.job_company} - ${row.job_role}`
    : row.contact_name ?? row.id;
  const contact = row.contact_name
    ? `${row.contact_name}${row.contact_title ? ` (${row.contact_title})` : ""}`
    : "Unknown contact";
  return {
    jobID: row.job_id ?? "",
    title,
    detail: `${contact}: ${row.ranking_reason ?? "Ready for research."}`,
    status: row.status ?? "ready_to_research",
  };
}

function recruiterDTO(row) {
  return {
    id: row.id,
    subject: row.subject ?? "",
    company: row.company ?? "",
    status: row.status ?? "",
    needsResponse: Boolean(row.needs_response),
    detail: row.notes ?? "",
  };
}

function analyticsDTO(store) {
  const latest = store.latestMetricSnapshot();
  if (latest?.payload_json) {
    const payload = JSON.parse(latest.payload_json);
    return {
      trackerRowCount: payload.primaryKpi?.denominator ?? 0,
      novaDCCompatibleCount: payload.primaryKpi?.denominator ?? 0,
      smallSampleWarning: payload.primaryKpi?.smallSampleWarning ?? "",
      primaryKPIDescription: "Interview rate percentage for NoVA/DC-compatible roles.",
      recommendationScaffold: payload.recommendations?.[0]?.summary ?? "Run npm run maxim:analytics for recommendations.",
    };
  }
  return {
    trackerRowCount: 0,
    novaDCCompatibleCount: 0,
    smallSampleWarning: "No MetricSnapshot is available yet.",
    primaryKPIDescription: "Interview rate percentage for NoVA/DC-compatible roles.",
    recommendationScaffold: "Run npm run maxim:analytics to create a local MetricSnapshot.",
  };
}

export function buildDashboardSnapshot({ store = createStore(), now = new Date() } = {}) {
  const todayJobs = store.listTodayActions().map(todayJobAction);
  const readyDrafts = store.listReadyMessageDrafts().map(readyDraftAction);
  const recruiterNeedsResponse = store.listRecruiterNeedsResponse().map(recruiterAction);
  const highConvictionJobs = store.listHighConviction().map(jobDTO);
  const networkingQueue = store.listNetworkingQueue().map(networkingDTO);
  const recruiterInbox = store.listRecruiterThreads().map(recruiterDTO);
  return {
    generatedAt: now.toISOString(),
    todayActions: [...todayJobs, ...readyDrafts, ...recruiterNeedsResponse],
    highConvictionJobs,
    networkingQueue,
    recruiterInbox,
    analytics: analyticsDTO(store),
  };
}

export function writeDashboardSnapshot({
  store = createStore(),
  outputPath = fromRoot("data", "maxim", "dashboard-state.json"),
  now = new Date(),
} = {}) {
  const snapshot = buildDashboardSnapshot({ store, now });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return { outputPath, snapshot };
}
