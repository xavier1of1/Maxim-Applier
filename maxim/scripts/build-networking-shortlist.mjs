import fs from "node:fs";

import { rankContactsForJob } from "../lib/contact-ranker.mjs";
import { createStore, stableId } from "../lib/sqlite-store.mjs";

const jobPath = process.argv[2];
const contactsPath = process.argv[3];
const shouldStore = !process.argv.includes("--no-store");
if (!jobPath || !contactsPath) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message: "Usage: node maxim/scripts/build-networking-shortlist.mjs job.json contacts.json [--no-store]",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
const contacts = JSON.parse(fs.readFileSync(contactsPath, "utf8"));
const jobId = job.id ?? job.jobId ?? stableId("job", `${job.company ?? ""}|${job.role ?? job.title ?? ""}|${job.jobUrl ?? job.url ?? ""}`);
const shortlist = rankContactsForJob(job, contacts);
let stored = null;

if (shouldStore) {
  const store = createStore();
  const targets = shortlist.map((item) => {
    const contact = store.upsertContact(item.contact);
    return store.upsertNetworkingTarget({
      jobId,
      contactId: contact.id,
      rankScore: item.rankScore,
      rankingReason: item.rankingReason,
      status: "ready_to_research",
    });
  });
  stored = {
    jobId,
    contacts: targets.length,
    targets: targets.length,
  };
}

console.log(JSON.stringify({ ok: true, jobId, stored, shortlist }, null, 2));
