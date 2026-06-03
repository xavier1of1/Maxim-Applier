import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { fromRoot } from "../../lib/path-utils.mjs";
import { parseHistoryCsv } from "../../lib/history-importer.mjs";

test("historical CSV import preserves raw rows and derives interview signal", () => {
  const text = fs.readFileSync(fromRoot("maxim/tests/fixtures/history-sample.csv"), "utf8");
  const rows = parseHistoryCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].raw["Interview Round"], "Phone Screen");
  assert.equal(rows[0].normalized.interviewSignal, true);
  assert.equal(rows[1].normalized.interviewSignal, false);
});
