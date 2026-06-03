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
  }

  init() {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const schema = fs.readFileSync(this.schemaPath, "utf8");
    runPythonSqlite({ op: "script", dbPath: this.dbPath, script: schema });
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
