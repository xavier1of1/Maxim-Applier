import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { fromRoot } from "../lib/path-utils.mjs";

function collectTests(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectTests(fullPath);
    }
    return entry.name.endsWith(".test.mjs") ? [fullPath] : [];
  });
}

const files = collectTests(fromRoot("maxim", "tests")).sort();
if (files.length === 0) {
  console.error("No Maxim test files found.");
  process.exit(1);
}

const result = spawnSync("node", ["--test", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
