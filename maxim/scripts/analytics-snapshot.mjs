import { createMetricSnapshot } from "../lib/metrics.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const store = createStore();
const records = store.query(
  `SELECT a.*, e.location_text AS locationText
   FROM applications a
   LEFT JOIN maxim_jobs j ON j.id = a.job_id
   LEFT JOIN career_ops_evaluations e ON e.id = j.evaluation_id`,
);
const snapshot = createMetricSnapshot(records);
store.execute(
  `INSERT OR REPLACE INTO metric_snapshots (id, period_start, period_end, primary_kpi, payload_json, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [
    `metric_${snapshot.generatedAt.slice(0, 10)}`,
    snapshot.generatedAt.slice(0, 10),
    snapshot.generatedAt.slice(0, 10),
    snapshot.primaryKpi.value,
    JSON.stringify(snapshot),
    snapshot.generatedAt,
  ],
);
console.log(JSON.stringify(snapshot, null, 2));
