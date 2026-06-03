import test from "node:test";
import assert from "node:assert/strict";

import { assessOperationalReadiness } from "../../lib/operational-readiness.mjs";

test("operational readiness distinguishes runnable system from missing real Career-Ops artifacts", () => {
  const store = {
    query(sql) {
      if (sql.includes("contacts")) return [{ count: 2 }];
      if (sql.includes("target_companies")) return [{ count: 1 }];
      if (sql.includes("metric_snapshots")) return [{ count: 1 }];
      if (sql.includes("notifications")) return [{ count: 0 }];
      return [{ count: 0 }];
    },
  };

  const report = assessOperationalReadiness({
    store,
    env: {
      OPENAI_API_KEY: "present",
      GEMINI_API_KEY: "present",
      MAXIM_DISCORD_WEBHOOK_URL: "present",
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.operationalReady, false);
  assert.ok(report.summary.hardOperationalBlockers >= 1);
  assert.ok(report.nextActions.some((action) => action.includes("evaluations")));
});
