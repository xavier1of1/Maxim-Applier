import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { fromRoot } from "../../lib/path-utils.mjs";
import { importHistoryFile } from "../../lib/history-importer.mjs";
import { SQLiteMaximStore } from "../../lib/sqlite-store.mjs";

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

test("historical imports are stored idempotently with raw and normalized rows split", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-history-store-"));
  const sourcePath = fromRoot("maxim/tests/fixtures/history-sample.csv");
  const result = importHistoryFile(sourcePath, {
    rawDir: path.join(tmp, "raw"),
    normalizedDir: path.join(tmp, "normalized"),
  });
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });

  const first = store.upsertHistoricalImport(result);
  const second = store.upsertHistoricalImport(result);

  assert.equal(first.rawRows, 2);
  assert.equal(second.normalizedRows, 2);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM historical_import_batches")[0].count, 1);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM historical_application_raw_rows")[0].count, 2);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM historical_application_normalized_rows")[0].count, 2);
  assert.equal(
    store.query("SELECT interview_signal FROM historical_application_normalized_rows ORDER BY row_number")[0]
      .interview_signal,
    1,
  );
  assert.equal(store.query("SELECT COUNT(*) AS count FROM audit_events")[0].count, 2);
});
