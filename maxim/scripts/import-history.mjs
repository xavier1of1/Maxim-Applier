import { importHistoryFile } from "../lib/history-importer.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.log(JSON.stringify({ ok: false, message: "Provide a CSV or XLSX historical tracker path." }, null, 2));
  process.exit(1);
}

const result = importHistoryFile(sourcePath);
const stored = createStore().upsertHistoricalImport(result);
console.log(
  JSON.stringify(
    {
      ok: true,
      report: result.report,
      rawCopyPath: result.rawCopyPath,
      normalizedOutputPath: result.normalizedOutputPath,
      stored,
    },
    null,
    2,
  ),
);
