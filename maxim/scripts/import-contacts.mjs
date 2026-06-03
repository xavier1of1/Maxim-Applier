import { importContactsCsv, parseContactsCsv } from "../lib/contact-importer.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const filePath = process.argv[2];
const noStore = process.argv.includes("--no-store");

if (!filePath) {
  console.log(
    JSON.stringify(
      { ok: false, message: "Usage: node maxim/scripts/import-contacts.mjs contacts.csv [--no-store]" },
      null,
      2,
    ),
  );
  process.exit(1);
}

if (noStore) {
  const fs = await import("node:fs");
  const contacts = parseContactsCsv(fs.readFileSync(filePath, "utf8"));
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        parsed: contacts.length,
        signalCounts: {
          connectionStrength: contacts.filter((contact) => contact.connectionStrength >= 1).length,
          vtAlumni: contacts.filter((contact) => contact.vtAlumni).length,
          recruiterSignal: contacts.filter((contact) => contact.recruiterSignal).length,
          founderSignal: contacts.filter((contact) => contact.founderSignal).length,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const result = importContactsCsv(filePath, createStore());
console.log(JSON.stringify({ ok: true, dryRun: false, ...result }, null, 2));
