import path from "node:path";

import {
  discoverCareerOpsArtifacts,
  parseReportFile,
  parseTrackerFile,
} from "./careerops-parser.mjs";
import { MaximPolicyEngine } from "./policy-engine.mjs";
import { routeEvaluation } from "./tier-router.mjs";
import { createStore } from "./sqlite-store.mjs";

function linkPdf(evaluation, pdfPaths) {
  const haystack = `${evaluation.company ?? ""} ${evaluation.role ?? ""}`.toLowerCase();
  const scored = pdfPaths
    .map((pdfPath) => {
      const stem = path.basename(pdfPath).toLowerCase();
      const score = haystack
        .split(/\s+/)
        .filter((part) => part.length > 2 && stem.includes(part)).length;
      return { pdfPath, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].pdfPath : undefined;
}

export function syncCareerOpsArtifacts({
  root,
  store = createStore(),
  now = new Date(),
} = {}) {
  const artifacts = discoverCareerOpsArtifacts({ root });
  const policy = new MaximPolicyEngine();
  const warnings = [];
  const synced = { evaluations: 0, applications: 0, warnings };

  for (const reportPath of artifacts.reportPaths) {
    try {
      const parsed = parseReportFile(reportPath);
      parsed.pdfPath = linkPdf(parsed, artifacts.pdfPaths);
      const tierPreview = routeEvaluation(parsed);
      const flags = policy.evaluate(parsed, { tier: tierPreview.tier, now }).flags;
      const tierResult = routeEvaluation(parsed, flags);
      const evaluation = store.upsertEvaluation(parsed);
      const job = store.upsertJob({
        evaluationId: evaluation.id,
        company: evaluation.company,
        role: evaluation.role,
        tier: tierResult.tier,
        nextAction: tierResult.nextAction,
        explanation: tierResult.explanation,
        careerOpsScore: evaluation.score,
        priorityOverlay: tierResult.priorityOverlay,
      });
      store.replaceFlags(job.id, flags);
      store.appendAuditEvent({
        event_type: "CAREEROPS_SYNCED",
        entity_type: "CareerOpsEvaluation",
        entity_id: evaluation.id,
        reason: `Synced ${path.basename(reportPath)}`,
        payload: { reportPath, tier: tierResult.tier },
      });
      synced.evaluations += 1;
    } catch (error) {
      warnings.push(`Skipped report ${reportPath}: ${error.message}`);
    }
  }

  if (artifacts.trackerPath) {
    try {
      for (const application of parseTrackerFile(artifacts.trackerPath)) {
        store.upsertApplication(application);
        synced.applications += 1;
      }
    } catch (error) {
      warnings.push(`Skipped tracker ${artifacts.trackerPath}: ${error.message}`);
    }
  }

  return synced;
}
