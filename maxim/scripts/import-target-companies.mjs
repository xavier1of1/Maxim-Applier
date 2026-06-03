import { importTargetCompaniesCsv, parseTargetCompaniesCsv } from "../lib/target-company-importer.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const filePath = process.argv[2];
const noStore = process.argv.includes("--no-store");

if (!filePath) {
  console.log(
    JSON.stringify(
      { ok: false, message: "Usage: node maxim/scripts/import-target-companies.mjs target_companies.csv [--no-store]" },
      null,
      2,
    ),
  );
  process.exit(1);
}

if (noStore) {
  const fs = await import("node:fs");
  const targetCompanies = parseTargetCompaniesCsv(fs.readFileSync(filePath, "utf8"));
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        parsed: targetCompanies.length,
        signalCounts: {
          highPriority: targetCompanies.filter((item) => item.priority.toLowerCase() === "high").length,
          connectionStrength: targetCompanies.filter((item) => item.connectionStrength >= 1).length,
          locationFocus: targetCompanies.filter((item) => item.locationFocus).length,
          roleLanes: targetCompanies.filter((item) => item.roleLanes).length,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const result = importTargetCompaniesCsv(filePath, createStore());
console.log(JSON.stringify({ ok: true, dryRun: false, ...result }, null, 2));
