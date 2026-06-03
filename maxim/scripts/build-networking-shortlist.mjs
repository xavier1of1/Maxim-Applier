import fs from "node:fs";

import { rankContactsForJob } from "../lib/contact-ranker.mjs";

const jobPath = process.argv[2];
const contactsPath = process.argv[3];
if (!jobPath || !contactsPath) {
  console.log(JSON.stringify({ ok: false, message: "Usage: node maxim/scripts/build-networking-shortlist.mjs job.json contacts.json" }, null, 2));
  process.exit(1);
}

const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
const contacts = JSON.parse(fs.readFileSync(contactsPath, "utf8"));
console.log(JSON.stringify({ ok: true, shortlist: rankContactsForJob(job, contacts) }, null, 2));
