import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { fromRoot } from "../../lib/path-utils.mjs";
import { importHistoryFile, parseHistoryCsv, parseHistoryXlsx } from "../../lib/history-importer.mjs";

function writeMinimalXlsx(targetPath) {
  const script = String.raw`
import sys
import zipfile

target = sys.argv[1]
sheet_xml = """<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Company</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Role</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Interview Round</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Application Status</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>Acme Systems</t></is></c>
      <c r="B2" t="inlineStr"><is><t>Software Engineer</t></is></c>
      <c r="C2" t="inlineStr"><is><t>Technical Screen</t></is></c>
      <c r="D2" t="inlineStr"><is><t>Applied</t></is></c>
    </row>
  </sheetData>
</worksheet>"""
with zipfile.ZipFile(target, "w") as zf:
    zf.writestr("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>""")
    zf.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>""")
    zf.writestr("xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Applications" sheetId="1" r:id="rId1"/></sheets></workbook>""")
    zf.writestr("xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>""")
    zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
`;
  const result = spawnSync("python", ["-c", script, targetPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("historical CSV import preserves raw rows and derives interview signal", () => {
  const text = fs.readFileSync(fromRoot("maxim/tests/fixtures/history-sample.csv"), "utf8");
  const rows = parseHistoryCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].raw["Interview Round"], "Phone Screen");
  assert.equal(rows[0].normalized.interviewSignal, true);
  assert.equal(rows[1].normalized.interviewSignal, false);
});

test("historical XLSX import reads first worksheet and derives interview signal", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-xlsx-"));
  const workbookPath = path.join(tmp, "history.xlsx");
  writeMinimalXlsx(workbookPath);

  const rows = parseHistoryXlsx(workbookPath);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].raw.Company, "Acme Systems");
  assert.equal(rows[0].normalized.interviewRound, "Technical Screen");
  assert.equal(rows[0].normalized.interviewSignal, true);
});

test("historical import preserves raw file and writes separate normalized output", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-history-"));
  const sourcePath = fromRoot("maxim/tests/fixtures/history-sample.csv");
  const result = importHistoryFile(sourcePath, {
    rawDir: path.join(tmp, "raw"),
    normalizedDir: path.join(tmp, "normalized"),
  });

  assert.equal(fs.existsSync(result.rawCopyPath), true);
  assert.equal(fs.existsSync(result.normalizedOutputPath), true);
  assert.equal(fs.readFileSync(result.rawCopyPath, "utf8"), fs.readFileSync(sourcePath, "utf8"));
  const normalized = JSON.parse(fs.readFileSync(result.normalizedOutputPath, "utf8"));
  assert.equal(normalized.rows.length, 2);
  assert.equal(normalized.rows[0].raw, undefined);
});
