import "dotenv/config";

import { assessOperationalReadiness } from "../lib/operational-readiness.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const strict = process.argv.includes("--strict");
const result = assessOperationalReadiness({ store: createStore() });

console.log(JSON.stringify(result, null, 2));

if (strict && !result.operationalReady) {
  process.exit(1);
}
