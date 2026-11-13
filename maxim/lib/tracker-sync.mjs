import fs from "node:fs";
import path from "node:path";

import {
  discoverCareerOpsArtifacts,
  parseReportFile,
  parseTrackerFile,
} from "./careerops-parser.mjs";
import { MaximPolicyEngine } from "./policy-engine.mjs";
import { fromRoot } from "./path-utils.mjs";
import { routeEvaluation } from "./tier-router.mjs";
import { createStore } from "./sqlite-store.mjs";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameReportPath(left, right) {
  if (!left || !right) {
    return false;
  }
  return path.basename(left).toLowerCase() === path.basename(right).toLowerCase();
}

function resolvePath(root, maybePath) {
  if (!maybePath) {
    return undefined;
  }
  return path.isAbsolute(maybePath) ? maybePath : path.join(root, maybePath);
}

function loadJobUrlOverrides(root) {
  const overridePath = path.join(root, "data", "maxim", "job_url_overrides.json");
  if (!fs.existsSync(overridePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(overridePath, "utf8"));
    return Array.isArray(parsed.overrides) ? parsed.overrides : [];
  } catch {
    return [];
  }
}

function overrideMatches(evaluation, override) {
  const match = override.match ?? {};
  if (match.sourceUrl && match.sourceUrl !== evaluation.jobUrl) {
    return false;
  }
  if (match.company && normalizeText(match.company) !== normalizeText(evaluation.company)) {
    return false;
  }
  if (match.role && !normalizeText(evaluation.role).includes(normalizeText(match.role))) {
    return false;
  }
  return Boolean(override.jobUrl);
}

function applyJobUrlOverride(evaluation, overrides) {
  const override = overrides.find((candidate) => overrideMatches(evaluation, candidate));
  if (!override) {
    return evaluation;
  }
  return {
    ...evaluation,
    jobUrl: override.jobUrl,
    rawPayload: {
      ...(evaluation.rawPayload ?? {}),
      originalJobUrl: evaluation.jobUrl,
      jobUrlOverride: {
        jobUrl: override.jobUrl,
        reason: override.reason ?? "local_job_url_override",
      },
    },
  };
}

function linkPdf(evaluation, pdfPaths, root) {
  const explicitPdf = resolvePath(root, evaluation.pdfPath);
  if (explicitPdf && fs.existsSync(explicitPdf)) {
    return explicitPdf;
  }
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

function findMatchingEvaluation(application, evaluations) {
  return (
    evaluations.find((evaluation) => application.jobUrl && evaluation.jobUrl === application.jobUrl) ??
    evaluations.find((evaluation) => sameReportPath(application.reportPath, evaluation.reportPath)) ??
    evaluations.find((evaluation) => {
      const companyMatches = normalizeText(evaluation.company) === normalizeText(application.company);
      const leftRole = normalizeText(evaluation.role);
      const rightRole = normalizeText(application.role);
      const roleMatches = leftRole === rightRole || leftRole.includes(rightRole) || rightRole.includes(leftRole);
      return companyMatches && roleMatches;
    })
  );
}

function enrichTrackerApplication(application, evaluations, jobs, root) {
  const evaluation = findMatchingEvaluation(application, evaluations);
  if (!evaluation) {
    return application;
  }
  const job = jobs.find((candidate) => candidate.evaluationId === evaluation.id);
  return {
    ...application,
    jobId: job?.id ?? application.jobId,
    careerOpsRowKey: evaluation.id,
    company: evaluation.company ?? application.company,
    role: evaluation.role ?? application.role,
    score: evaluation.score ?? application.score,
    tier: job?.tier ?? application.tier,
    source: evaluation.source ?? application.source,
    pdfPath: evaluation.pdfPath ?? application.pdfPath,
    reportPath: evaluation.reportPath ?? resolvePath(root, application.reportPath),
    jobUrl: evaluation.jobUrl ?? application.jobUrl,
    rawPayload: {
      ...(application.rawPayload ?? {}),
      syncedEvaluationId: evaluation.id,
      syncedJobId: job?.id,
      packetReady: Boolean(evaluation.reportPath && evaluation.pdfPath),
    },
  };
}

export function syncCareerOpsArtifacts({
  root,
  store = createStore(),
  now = new Date(),
} = {}) {
  const artifacts = discoverCareerOpsArtifacts({ root });
  const artifactRoot = root ?? fromRoot();
  const policy = new MaximPolicyEngine();
  const jobUrlOverrides = loadJobUrlOverrides(artifactRoot);
  const warnings = [];
  const synced = { evaluations: 0, applications: 0, warnings };
  const evaluations = [];
  const jobs = [];

  for (const reportPath of artifacts.reportPaths) {
    try {
      const parsed = applyJobUrlOverride(parseReportFile(reportPath), jobUrlOverrides);
      parsed.pdfPath = linkPdf(parsed, artifacts.pdfPaths, artifactRoot);
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
      evaluations.push(evaluation);
      jobs.push(job);
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
        store.upsertApplication(enrichTrackerApplication(application, evaluations, jobs, artifactRoot));
        synced.applications += 1;
      }
    } catch (error) {
      warnings.push(`Skipped tracker ${artifacts.trackerPath}: ${error.message}`);
    }
  }

  return synced;
}
