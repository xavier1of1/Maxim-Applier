import { importHistoryCsv } from "../lib/history-importer.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.log(JSON.stringify({ ok: false, message: "Provide a CSV path. XLSX import is deferred to the Python backend/openpyxl path." }, null, 2));
  process.exit(1);
}

const result = importHistoryCsv(sourcePath);
console.log(JSON.stringify({ ok: true, report: result.report, rawCopyPath: result.rawCopyPath }, null, 2));
