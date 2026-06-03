import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

import { EventLog } from "./event-log.mjs";
import { fromRoot } from "./path-utils.mjs";

const PY_SQLITE_BRIDGE = String.raw`
import json
import sqlite3
import sys

req = json.load(sys.stdin)
conn = sqlite3.connect(req["dbPath"])
conn.row_factory = sqlite3.Row
try:
    op = req["op"]
    if op == "script":
        conn.executescript(req["script"])
        conn.commit()
        print(json.dumps({"ok": True}))
    elif op == "execute":
        cur = conn.execute(req["sql"], req.get("params", []))
        conn.commit()
        print(json.dumps({"ok": True, "changes": conn.total_changes, "lastrowid": cur.lastrowid}))
    elif op == "executemany":
        conn.executemany(req["sql"], req.get("params", []))
        conn.commit()
        print(json.dumps({"ok": True, "changes": conn.total_changes}))
    elif op == "query":
        cur = conn.execute(req["sql"], req.get("params", []))
        rows = [dict(row) for row in cur.fetchall()]
        print(json.dumps({"ok": True, "rows": rows}))
    else:
        raise ValueError(f"Unsupported operation: {op}")
finally:
    conn.close()
`;

function nowIso() {
  return new Date().toISOString();
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function boolInt(value) {
  if (typeof value === "string") {
    return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase()) ? 1 : 0;
  }
  return value ? 1 : 0;
}

function runPythonSqlite(payload) {
  const proc = spawnSync("python", ["-c", PY_SQLITE_BRIDGE], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(`SQLite bridge failed: ${proc.stderr || proc.stdout}`);
  }
  return JSON.parse(proc.stdout || "{}");
}

export class SQLiteMaximStore {
  constructor({
    dbPath = fromRoot("data", "maxim", "maxim.db"),
    schemaPath = fromRoot("maxim", "db", "schema.sql"),
    eventLog = new EventLog(),
  } = {}) {
    this.dbPath = dbPath;
    this.schemaPath = schemaPath;
    this.eventLog = eventLog;
    this.initialized = false;
  }

  init() {
    if (this.initialized) {
      return;
    }
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const schema = fs.readFileSync(this.schemaPath, "utf8");
    runPythonSqlite({ op: "script", dbPath: this.dbPath, script: schema });
    this.migrateLegacyColumns();
    this.initialized = true;
  }

  migrateLegacyColumns() {
    const migrations = [
      ["contacts", "vt_alumni", "INTEGER NOT NULL DEFAULT 0"],
      ["contacts", "recruiter_signal", "INTEGER NOT NULL DEFAULT 0"],
      ["contacts", "founder_signal", "INTEGER NOT NULL DEFAULT 0"],
      ["contacts", "role_relevance", "TEXT"],
      ["contacts", "raw_payload_json", "TEXT NOT NULL DEFAULT '{}'"],
    ];
    for (const [table, column, definition] of migrations) {
      const columns = runPythonSqlite({
        op: "query",
        dbPath: this.dbPath,
        sql: `PRAGMA table_info(${table})`,
      }).rows;
      if (!columns.some((row) => row.name === column)) {
        runPythonSqlite({
          op: "execute",
          dbPath: this.dbPath,
          sql: `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
        });
      }
    }
  }

  execute(sql, params = []) {
    this.init();
    return runPythonSqlite({ op: "execute", dbPath: this.dbPath, sql, params });
  }

  query(sql, params = []) {
    this.init();
    return runPythonSqlite({ op: "query", dbPath: this.dbPath, sql, params }).rows;
  }

  upsertEvaluation(evaluation) {
    this.init();
    const timestamp = nowIso();
    const id =
      evaluation.id ??
      stableId(
        "eval",
        evaluation.reportPath ??
          `${evaluation.company ?? ""}|${evaluation.role ?? ""}|${evaluation.jobUrl ?? ""}`,
      );
    const record = { ...evaluation, id };
    this.execute(
      `INSERT INTO career_ops_evaluations
      (id, report_path, pdf_path, company, role, score, source, job_url, location_text,
       salary_text, posted_at, summary, raw_payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         report_path=excluded.report_path,
         pdf_path=excluded.pdf_path,
         company=excluded.company,
         role=excluded.role,
         score=excluded.score,
         source=excluded.source,
         job_url=excluded.job_url,
         location_text=excluded.location_text,
         salary_text=excluded.salary_text,
         posted_at=excluded.posted_at,
         summary=excluded.summary,
         raw_payload_json=excluded.raw_payload_json,
         updated_at=excluded.updated_at`,
      [
        id,
        record.reportPath ?? null,
        record.pdfPath ?? null,
        record.company ?? null,
        record.role ?? null,
        record.score ?? null,
        record.source ?? "career_ops",
        record.jobUrl ?? null,
        record.locationText ?? null,
        record.salaryText ?? null,
        record.postedAt ?? null,
        record.summary ?? null,
        json(record.rawPayload ?? record),
        record.createdAt ?? timestamp,
        timestamp,
      ],
    );
    return record;
  }

  upsertJob(job) {
    this.init();
    const timestamp = nowIso();
    const id = job.id ?? stableId("job", job.evaluationId ?? `${job.company}|${job.role}`);
    this.execute(
      `INSERT INTO maxim_jobs
      (id, evaluation_id, company, role, tier, status, next_action, explanation,
       career_ops_score, priority_overlay, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(evaluation_id) DO UPDATE SET
         company=excluded.company,
         role=excluded.role,
         tier=excluded.tier,
         status=excluded.status,
         next_action=excluded.next_action,
         explanation=excluded.explanation,
         career_ops_score=excluded.career_ops_score,
         priority_overlay=excluded.priority_overlay,
         updated_at=excluded.updated_at`,
      [
        id,
        job.evaluationId ?? null,
        job.company ?? null,
        job.role ?? null,
        job.tier,
        job.status ?? "synced",
        job.nextAction,
        job.explanation ?? "",
        job.careerOpsScore ?? null,
        job.priorityOverlay ? 1 : 0,
        job.createdAt ?? timestamp,
        timestamp,
      ],
    );
    const rows = this.query("SELECT id FROM maxim_jobs WHERE evaluation_id = ?", [job.evaluationId ?? null]);
    return { ...job, id: rows[0]?.id ?? id };
  }

  replaceFlags(jobId, flags) {
    this.init();
    this.execute("DELETE FROM priority_flags WHERE job_id = ?", [jobId]);
    for (const flag of flags) {
      this.execute(
        `INSERT INTO priority_flags (id, job_id, flag_type, severity, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          flag.id ?? stableId("flag", `${jobId}|${flag.flagType}|${flag.reason}`),
          jobId,
          flag.flagType,
          flag.severity,
          flag.reason,
          flag.createdAt ?? nowIso(),
        ],
      );
    }
  }

  upsertApplication(application) {
    this.init();
    const timestamp = nowIso();
    const id =
      application.id ??
      stableId(
        "app",
        application.careerOpsRowKey ??
          `${application.company ?? ""}|${application.role ?? ""}|${application.jobUrl ?? ""}`,
      );
    this.execute(
      `INSERT INTO applications
      (id, job_id, career_ops_row_key, company, role, status, applied_at, score, tier,
       source, pdf_path, report_path, job_url, raw_payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status=excluded.status,
         applied_at=excluded.applied_at,
         score=excluded.score,
         tier=excluded.tier,
         raw_payload_json=excluded.raw_payload_json,
         updated_at=excluded.updated_at`,
      [
        id,
        application.jobId ?? null,
        application.careerOpsRowKey ?? null,
        application.company ?? null,
        application.role ?? null,
        application.status ?? "synced",
        application.appliedAt ?? null,
        application.score ?? null,
        application.tier ?? null,
        application.source ?? null,
        application.pdfPath ?? null,
        application.reportPath ?? null,
        application.jobUrl ?? null,
        json(application.rawPayload ?? application),
        application.createdAt ?? timestamp,
        timestamp,
      ],
    );
    return { ...application, id };
  }

  getEvaluation(id) {
    return this.query("SELECT * FROM career_ops_evaluations WHERE id = ?", [id])[0] ?? null;
  }

  getJobByEvaluation(evaluationId) {
    return this.query("SELECT * FROM maxim_jobs WHERE evaluation_id = ?", [evaluationId])[0] ?? null;
  }

  getApplication(id) {
    return this.query("SELECT * FROM applications WHERE id = ?", [id])[0] ?? null;
  }

  listApplications() {
    return this.query("SELECT * FROM applications ORDER BY updated_at DESC");
  }

  upsertHistoricalImport(importResult) {
    this.init();
    const timestamp = nowIso();
    this.execute(
      `INSERT INTO historical_import_batches
      (id, source_path, raw_copy_path, started_at, raw_row_count, normalized_row_count,
       issue_count, summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_path=excluded.source_path,
         raw_copy_path=excluded.raw_copy_path,
         raw_row_count=excluded.raw_row_count,
         normalized_row_count=excluded.normalized_row_count,
         issue_count=excluded.issue_count,
         summary_json=excluded.summary_json`,
      [
        importResult.batchId,
        importResult.sourcePath,
        importResult.rawCopyPath ?? null,
        timestamp,
        importResult.report?.rawRowCount ?? importResult.rows.length,
        importResult.report?.normalizedRowCount ?? importResult.rows.length,
        importResult.report?.issueCount ?? 0,
        json(importResult.report ?? {}),
      ],
    );

    this.execute("DELETE FROM historical_application_raw_rows WHERE batch_id = ?", [importResult.batchId]);
    this.execute("DELETE FROM historical_application_normalized_rows WHERE batch_id = ?", [importResult.batchId]);

    for (const row of importResult.rows) {
      const rawId = stableId("hist_raw", `${importResult.batchId}|${row.rowNumber}`);
      const normalizedId = stableId("hist_norm", `${importResult.batchId}|${row.rowNumber}`);
      this.execute(
        `INSERT INTO historical_application_raw_rows
        (id, batch_id, row_number, raw_payload_json)
        VALUES (?, ?, ?, ?)`,
        [rawId, importResult.batchId, row.rowNumber, json(row.raw)],
      );
      this.execute(
        `INSERT INTO historical_application_normalized_rows
        (id, batch_id, row_number, company, role, source, link, salary, date_submitted,
         interview_round, application_status_raw, interview_signal, normalized_outcome, issues_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedId,
          importResult.batchId,
          row.rowNumber,
          row.normalized.company ?? null,
          row.normalized.role ?? null,
          row.normalized.source ?? null,
          row.normalized.link ?? null,
          row.normalized.salary ?? null,
          row.normalized.dateSubmitted ?? null,
          row.normalized.interviewRound ?? null,
          row.normalized.applicationStatusRaw ?? null,
          row.normalized.interviewSignal ? 1 : 0,
          row.normalized.normalizedOutcome,
          json(row.normalized.issues ?? []),
        ],
      );
    }

    this.appendAuditEvent({
      event_type: "historical_import_upserted",
      entity_type: "historical_import_batch",
      entity_id: importResult.batchId,
      reason: "Historical tracker import recorded in Maxim local store",
      payload: importResult.report ?? {},
    });

    return {
      batchId: importResult.batchId,
      rawRows: importResult.rows.length,
      normalizedRows: importResult.rows.length,
    };
  }

  upsertContact(contact) {
    this.init();
    const timestamp = nowIso();
    const id =
      contact.id ??
      contact.contactId ??
      stableId("contact", `${contact.name ?? contact.fullName ?? ""}|${contact.company ?? ""}|${contact.linkedinUrl ?? ""}|${contact.email ?? ""}`);
    const vtAlumni = contact.vtAlumni ?? contact.vt_alumni ?? false;
    const recruiterSignal = contact.recruiterSignal ?? contact.recruiter_signal ?? false;
    const founderSignal = contact.founderSignal ?? contact.founder_signal ?? false;
    this.execute(
      `INSERT INTO contacts
      (id, name, company, title, linkedin_url, email, connection_strength,
       vt_alumni, recruiter_signal, founder_signal, role_relevance, source, notes,
       raw_payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        company=excluded.company,
        title=excluded.title,
        linkedin_url=excluded.linkedin_url,
        email=excluded.email,
        connection_strength=excluded.connection_strength,
        vt_alumni=excluded.vt_alumni,
        recruiter_signal=excluded.recruiter_signal,
        founder_signal=excluded.founder_signal,
        role_relevance=excluded.role_relevance,
        source=excluded.source,
        notes=excluded.notes,
        raw_payload_json=excluded.raw_payload_json,
        updated_at=excluded.updated_at`,
      [
        id,
        contact.name ?? contact.fullName ?? "Unknown Contact",
        contact.company ?? null,
        contact.title ?? null,
        contact.linkedinUrl ?? contact.linkedin_url ?? null,
        contact.email ?? null,
        contact.connectionStrength ?? contact.connection_strength ?? null,
        boolInt(vtAlumni),
        boolInt(recruiterSignal),
        boolInt(founderSignal),
        contact.roleRelevance ?? contact.role_relevance ?? null,
        contact.source ?? "manual_import",
        contact.notes ?? null,
        json(contact.rawPayload ?? contact),
        contact.createdAt ?? timestamp,
        timestamp,
      ],
    );
    return {
      ...contact,
      id,
      vtAlumni: boolInt(vtAlumni) === 1,
      recruiterSignal: boolInt(recruiterSignal) === 1,
      founderSignal: boolInt(founderSignal) === 1,
      roleRelevance: contact.roleRelevance ?? contact.role_relevance ?? null,
    };
  }

  upsertNetworkingTarget(target) {
    this.init();
    const timestamp = nowIso();
    const id = target.id ?? stableId("target", `${target.jobId}|${target.contactId}`);
    this.execute(
      `INSERT INTO networking_targets
      (id, job_id, contact_id, rank_score, ranking_reason, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id, contact_id) DO UPDATE SET
        rank_score=excluded.rank_score,
        ranking_reason=excluded.ranking_reason,
        status=excluded.status,
        updated_at=excluded.updated_at`,
      [
        id,
        target.jobId,
        target.contactId,
        target.rankScore,
        target.rankingReason,
        target.status ?? "ready_to_research",
        target.createdAt ?? timestamp,
        timestamp,
      ],
    );
    const rows = this.query("SELECT id FROM networking_targets WHERE job_id = ? AND contact_id = ?", [
      target.jobId,
      target.contactId,
    ]);
    return { ...target, id: rows[0]?.id ?? id };
  }

  upsertMessageDraft(draft) {
    this.init();
    const timestamp = nowIso();
    const id =
      draft.id ??
      stableId("draft", `${draft.targetId ?? ""}|${draft.jobId ?? ""}|${draft.contactId ?? ""}|${draft.draftText}`);
    this.execute(
      `INSERT INTO message_drafts
      (id, target_id, job_id, contact_id, channel, draft_text, cta, status, validation_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        draft_text=excluded.draft_text,
        cta=excluded.cta,
        status=excluded.status,
        validation_json=excluded.validation_json,
        updated_at=excluded.updated_at`,
      [
        id,
        draft.targetId ?? null,
        draft.jobId ?? null,
        draft.contactId ?? null,
        draft.channel ?? "linkedin_manual",
        draft.draftText,
        draft.cta ?? "",
        draft.status ?? "ready_to_send",
        json(draft.validation ?? {}),
        draft.createdAt ?? timestamp,
        timestamp,
      ],
    );
    this.appendAuditEvent({
      event_type: "message_draft_upserted",
      entity_type: "message_draft",
      entity_id: id,
      reason: "Ready-to-send manual networking draft recorded",
      payload: { channel: draft.channel ?? "linkedin_manual", status: draft.status ?? "ready_to_send" },
    });
    return { ...draft, id };
  }

  upsertRecruiterThread(thread) {
    this.init();
    const timestamp = nowIso();
    const id = thread.id ?? stableId("recruiter", `${thread.subject}|${thread.company ?? ""}|${thread.source ?? ""}`);
    const needsResponse = thread.needsResponse ?? thread.needs_response ?? false;
    const tags = thread.tags ?? [];
    this.execute(
      `INSERT INTO recruiter_threads
      (id, source, subject, company, status, needs_response, tags_json, last_activity_at, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source=excluded.source,
        subject=excluded.subject,
        company=excluded.company,
        status=excluded.status,
        needs_response=excluded.needs_response,
        tags_json=excluded.tags_json,
        last_activity_at=excluded.last_activity_at,
        notes=excluded.notes,
        updated_at=excluded.updated_at`,
      [
        id,
        thread.source ?? "manual",
        thread.subject,
        thread.company ?? null,
        thread.status ?? (needsResponse ? "Needs Response" : "Recruiter DM"),
        needsResponse ? 1 : 0,
        json(tags),
        thread.lastActivityAt ?? thread.last_activity_at ?? timestamp,
        thread.notes ?? null,
        thread.createdAt ?? timestamp,
        timestamp,
      ],
    );
    this.appendAuditEvent({
      event_type: "recruiter_thread_upserted",
      entity_type: "recruiter_thread",
      entity_id: id,
      reason: "Recruiter inbox thread recorded or updated manually",
      payload: { status: thread.status, needsResponse },
    });
    return { ...thread, id, needsResponse };
  }

  getRecruiterThread(id) {
    const rows = this.query("SELECT * FROM recruiter_threads WHERE id = ?", [id]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row,
      needsResponse: Boolean(row.needs_response),
      tags: JSON.parse(row.tags_json || "[]"),
      lastActivityAt: row.last_activity_at,
    };
  }

  listReadyMessageDrafts() {
    return this.query("SELECT * FROM message_drafts WHERE status = 'ready_to_send' ORDER BY updated_at DESC");
  }

  listNetworkingQueue() {
    return this.query(
      `SELECT
         nt.id,
         nt.job_id,
         nt.contact_id,
         nt.rank_score,
         nt.ranking_reason,
         nt.status,
         nt.updated_at,
         c.name AS contact_name,
         c.company AS contact_company,
         c.title AS contact_title,
         c.connection_strength,
         c.vt_alumni,
         c.recruiter_signal,
         c.founder_signal,
         c.role_relevance,
         j.company AS job_company,
         j.role AS job_role,
         j.tier AS job_tier
       FROM networking_targets nt
       LEFT JOIN contacts c ON c.id = nt.contact_id
       LEFT JOIN maxim_jobs j ON j.id = nt.job_id
       ORDER BY nt.rank_score DESC, nt.updated_at DESC`,
    );
  }

  listRecruiterNeedsResponse() {
    return this.query("SELECT * FROM recruiter_threads WHERE needs_response = 1 ORDER BY last_activity_at DESC");
  }

  listRecruiterThreads() {
    return this.query("SELECT * FROM recruiter_threads ORDER BY last_activity_at DESC");
  }

  listNotificationFingerprints() {
    return this.query("SELECT fingerprint FROM notifications").map((row) => row.fingerprint);
  }

  latestMetricSnapshot() {
    const rows = this.query("SELECT * FROM metric_snapshots ORDER BY created_at DESC LIMIT 1");
    return rows[0] ?? null;
  }

  listHighConviction() {
    return this.query(
      `SELECT j.*, group_concat(f.flag_type || ':' || f.severity, ', ') AS flags
       FROM maxim_jobs j
       LEFT JOIN priority_flags f ON f.job_id = j.id
       WHERE j.tier = 'T3' OR (j.tier = 'T2' AND j.priority_overlay = 1)
       GROUP BY j.id
       ORDER BY j.tier DESC, j.career_ops_score DESC`,
    );
  }

  listTodayActions() {
    return this.query(
      `SELECT j.*, group_concat(f.flag_type || ':' || f.severity, ', ') AS flags
       FROM maxim_jobs j
       LEFT JOIN priority_flags f ON f.job_id = j.id
       WHERE j.tier IN ('T2', 'T3') OR j.priority_overlay = 1
       GROUP BY j.id
       ORDER BY
         CASE WHEN j.tier = 'T3' THEN 0 WHEN j.priority_overlay = 1 THEN 1 ELSE 2 END,
         j.career_ops_score DESC`,
    );
  }

  appendAuditEvent(event) {
    const record = this.eventLog.append(event);
    this.execute(
      `INSERT INTO audit_events
      (id, event_type, entity_type, entity_id, actor, reason, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.event_id,
        record.event_type,
        record.entity_type,
        record.entity_id,
        record.actor,
        record.reason,
        json(record.payload),
        record.timestamp,
      ],
    );
    return record;
  }
}

export function createStore(options) {
  const store = new SQLiteMaximStore(options);
  store.init();
  return store;
}

export { stableId };
