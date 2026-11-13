import { assignTier } from "./tier-router.mjs";
import { detectDuplicateRisk } from "./duplicate-detector.mjs";

export const APPLY_WORKFLOW_STATUSES = Object.freeze({
  PACKET_NEEDED: "packet_needed",
  READY_FOR_ASSISTED_APPLY: "ready_for_assisted_apply",
  DUPLICATE_REVIEW_REQUIRED: "duplicate_review_required",
  ASSISTED_APPLY_STARTED: "assisted_apply_started",
  SUBMITTED_MANUALLY: "submitted_manually",
  NOT_ELIGIBLE: "not_eligible_for_apply_queue",
});

const ACTIVE_OR_FINAL_STATUSES = new Set([
  APPLY_WORKFLOW_STATUSES.READY_FOR_ASSISTED_APPLY,
  APPLY_WORKFLOW_STATUSES.ASSISTED_APPLY_STARTED,
  APPLY_WORKFLOW_STATUSES.SUBMITTED_MANUALLY,
]);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findExistingApplication(evaluation, existing) {
  return existing.find((application) => application.career_ops_row_key === evaluation.id) ??
    existing.find((application) => application.job_url && evaluation.jobUrl && application.job_url === evaluation.jobUrl) ??
    existing.find((application) => {
      const companyMatches = normalizeText(application.company) === normalizeText(evaluation.company);
      const leftRole = normalizeText(application.role);
      const rightRole = normalizeText(evaluation.role);
      return companyMatches && (leftRole === rightRole || leftRole.includes(rightRole) || rightRole.includes(leftRole));
    });
}

export function buildApplyWorkflow(record) {
  const packetReady = Boolean(record.packetReady ?? (record.reportPath && record.pdfPath));
  const duplicate = record.duplicate ?? { duplicateRisk: "unknown", action: "review", warning: "" };
  const tier = record.tier ?? assignTier(record.score).tier;
  const eligible = ["T2", "T3"].includes(tier);
  const warnings = [];
  if (!eligible) {
    warnings.push("Only T2/T3 roles enter the default Maxim assisted apply queue.");
  }
  if (!packetReady) {
    warnings.push("Career-Ops report and tailored PDF must exist before applying.");
  }
  if (duplicate.duplicateRisk === "high") {
    warnings.push(duplicate.warning || "Possible duplicate application requires review.");
  }

  let status = APPLY_WORKFLOW_STATUSES.READY_FOR_ASSISTED_APPLY;
  if (!eligible) {
    status = APPLY_WORKFLOW_STATUSES.NOT_ELIGIBLE;
  } else if (duplicate.duplicateRisk === "high") {
    status = APPLY_WORKFLOW_STATUSES.DUPLICATE_REVIEW_REQUIRED;
  } else if (!packetReady) {
    status = APPLY_WORKFLOW_STATUSES.PACKET_NEEDED;
  }

  return {
    eligible,
    packetReady,
    duplicateRisk: duplicate.duplicateRisk,
    status,
    manualSubmissionRequired: true,
    prohibitedAutomation: ["final_application_submission", "linkedin_message_send"],
    nextAction:
      status === APPLY_WORKFLOW_STATUSES.READY_FOR_ASSISTED_APPLY
        ? "Open the job, run Career-Ops apply assistant, review answers, submit manually, then mark submitted."
        : warnings[0] ?? "Review this application before acting.",
    commands: {
      start: "npm run maxim:application -- started <application-id>",
      assistant: "/career-ops apply",
      submitted: "npm run maxim:application -- submitted <application-id>",
    },
    warnings,
  };
}

export function buildApplicationRecord({ job, evaluation, status = "packet_needed", priorApplications = [] }) {
  const tier = assignTier(evaluation.score).tier;
  const duplicate = detectDuplicateRisk(
    {
      company: evaluation.company,
      role: evaluation.role,
      jobUrl: evaluation.jobUrl,
      jobId: job?.id,
    },
    priorApplications,
  );
  const record = {
    jobId: job?.id,
    careerOpsRowKey: evaluation.id,
    company: evaluation.company,
    role: evaluation.role,
    status,
    score: evaluation.score,
    tier,
    source: evaluation.source,
    pdfPath: evaluation.pdfPath,
    reportPath: evaluation.reportPath,
    jobUrl: evaluation.jobUrl,
    duplicate,
    packetReady: Boolean(evaluation.reportPath && evaluation.pdfPath),
  };
  const workflow = buildApplyWorkflow(record);
  return {
    ...record,
    status: status === "packet_needed" ? workflow.status : status,
    applyWorkflow: workflow,
    rawPayload: {
      duplicate,
      packetReady: record.packetReady,
      applyWorkflow: workflow,
    },
  };
}

export function markAssistedApplyStarted(record) {
  return { ...record, status: APPLY_WORKFLOW_STATUSES.ASSISTED_APPLY_STARTED };
}

export function markSubmittedManually(record, submittedAt = new Date()) {
  return { ...record, status: APPLY_WORKFLOW_STATUSES.SUBMITTED_MANUALLY, appliedAt: submittedAt.toISOString() };
}

function toEvaluation(row) {
  return {
    id: row.evaluation_id ?? row.id,
    company: row.company,
    role: row.role,
    score: row.score ?? row.career_ops_score,
    source: row.source,
    pdfPath: row.pdf_path,
    reportPath: row.report_path,
    jobUrl: row.job_url,
  };
}

function toJob(row) {
  return row.job_id
    ? {
        id: row.job_id,
        evaluationId: row.evaluation_id,
        tier: row.maxim_tier,
        nextAction: row.next_action,
      }
    : undefined;
}

export function queueEligibleApplications({ store, dryRun = false, includeT1 = false } = {}) {
  if (!store) {
    throw new Error("queueEligibleApplications requires a Maxim store.");
  }
  const candidates = store.listApplicationCandidates();
  const existing = store.listApplications();
  const queued = [];
  const skipped = [];

  for (const candidate of candidates) {
    const evaluation = toEvaluation(candidate);
    const job = toJob(candidate);
    const tier = job?.tier ?? assignTier(evaluation.score).tier;
    const existingApplication = findExistingApplication(evaluation, existing);
    if (existingApplication && ACTIVE_OR_FINAL_STATUSES.has(existingApplication.status)) {
      skipped.push({ evaluationId: evaluation.id, company: evaluation.company, role: evaluation.role, reason: "already_queued" });
      continue;
    }
    if (!["T2", "T3"].includes(tier) && !(includeT1 && tier === "T1")) {
      skipped.push({ evaluationId: evaluation.id, company: evaluation.company, role: evaluation.role, tier, reason: "tier_not_default_apply_queue" });
      continue;
    }
    const priorApplications = existing.filter((application) => application.id !== existingApplication?.id);
    const record = {
      ...buildApplicationRecord({ job, evaluation, priorApplications }),
      id: existingApplication?.id,
      appliedAt: existingApplication?.applied_at,
    };
    const stored = dryRun ? { ...record, id: record.id ?? null } : store.upsertApplication(record);
    if (!dryRun) {
      store.appendAuditEvent({
        event_type: "application_apply_workflow_queued",
        entity_type: "application",
        entity_id: stored.id,
        reason: "Maxim assisted apply workflow queued from synced Career-Ops evaluation",
        payload: {
          company: stored.company,
          role: stored.role,
          score: stored.score,
          tier: stored.tier,
          status: stored.status,
        },
      });
    }
    queued.push(stored);
    existing.push(stored);
  }

  return {
    ok: true,
    dryRun,
    queuedCount: queued.length,
    skippedCount: skipped.length,
    queued,
    skipped,
    safety: {
      manualSubmissionRequired: true,
      finalSubmissionAutomation: "not_implemented",
      linkedInSending: "not_implemented",
    },
  };
}
