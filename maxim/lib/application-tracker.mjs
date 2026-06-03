import { assignTier } from "./tier-router.mjs";
import { detectDuplicateRisk } from "./duplicate-detector.mjs";

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
  return {
    jobId: job?.id,
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
}

export function markAssistedApplyStarted(record) {
  return { ...record, status: "assisted_apply_started" };
}

export function markSubmittedManually(record, submittedAt = new Date()) {
  return { ...record, status: "submitted_manually", appliedAt: submittedAt.toISOString() };
}
