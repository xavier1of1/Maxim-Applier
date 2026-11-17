import {
  buildApplicationRecord,
  markAssistedApplyStarted,
  markSubmittedManually,
  queueEligibleApplications,
} from "../lib/application-tracker.mjs";
import { createStore } from "../lib/sqlite-store.mjs";
import {readAuthority} from '../lib/authority-gate.mjs';
import {runWorkspaceCommand} from '../lib/workspace-client.mjs';

const command = process.argv[2] ?? "help";
if(readAuthority().applications==='canonical'){
 try{console.log(JSON.stringify(await runWorkspaceCommand(),null,2));}
 catch(e){console.error(JSON.stringify({ok:false,message:e.message}));process.exitCode=1;}
}else{
const store = createStore();

function fail(message) {
  console.log(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
}

function recordAudit(eventType, application, reason) {
  store.appendAuditEvent({
    event_type: eventType,
    entity_type: "application",
    entity_id: application.id,
    reason,
    payload: {
      status: application.status,
      company: application.company,
      role: application.role,
      score: application.score,
      tier: application.tier,
    },
  });
}

if (command === "create") {
  const evaluationId = process.argv[3];
  if (!evaluationId) {
    fail("Usage: npm run maxim:application -- create <career-ops-evaluation-id>");
  }
  const evaluationRow = store.getEvaluation(evaluationId);
  if (!evaluationRow) {
    fail(`Career-Ops evaluation not found: ${evaluationId}`);
  }
  const evaluation = {
    id: evaluationRow.id,
    company: evaluationRow.company,
    role: evaluationRow.role,
    score: evaluationRow.score,
    source: evaluationRow.source,
    pdfPath: evaluationRow.pdf_path,
    reportPath: evaluationRow.report_path,
    jobUrl: evaluationRow.job_url,
  };
  const job = store.getJobByEvaluation(evaluationId);
  const priorApplications = store.listApplications();
  const record = buildApplicationRecord({ job, evaluation, priorApplications });
  const stored = store.upsertApplication(record);
  recordAudit("application_record_created", stored, "Manual application packet record created from Career-Ops evaluation");
  console.log(JSON.stringify({ ok: true, application: stored, duplicate: record.duplicate }, null, 2));
} else if (command === "queue") {
  const dryRun = process.argv.includes("--dry-run");
  const includeT1 = process.argv.includes("--include-t1");
  const result = queueEligibleApplications({ store, dryRun, includeT1 });
  console.log(JSON.stringify(result, null, 2));
} else if (command === "started") {
  const applicationId = process.argv[3];
  const current = applicationId ? store.getApplication(applicationId) : null;
  if (!current) {
    fail("Usage: npm run maxim:application -- started <application-id>");
  }
  const stored = store.upsertApplication(markAssistedApplyStarted(current));
  recordAudit("application_assisted_apply_started", stored, "Assisted apply started manually");
  console.log(JSON.stringify({ ok: true, application: stored }, null, 2));
} else if (command === "submitted") {
  const applicationId = process.argv[3];
  const current = applicationId ? store.getApplication(applicationId) : null;
  if (!current) {
    fail("Usage: npm run maxim:application -- submitted <application-id>");
  }
  const stored = store.upsertApplication(markSubmittedManually(current));
  recordAudit("application_submitted_manually", stored, "Application marked submitted manually; no automated submission path was used");
  console.log(JSON.stringify({ ok: true, application: stored }, null, 2));
} else if (command === "list") {
  console.log(JSON.stringify({ ok: true, applications: store.listApplications() }, null, 2));
} else {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message: "Legacy-only commands: create <evaluation-id>, queue [--dry-run] [--include-t1], started <application-id>, submitted <application-id>, list. After cutover use maxim:applications -- help.",
      },
      null,
      2,
    ),
  );
}
}
