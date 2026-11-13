import fs from "node:fs";

import { rankContactsForJob } from "../lib/contact-ranker.mjs";
import { buildNetworkingQueue } from "../lib/networking-workflow.mjs";
import { createStore, stableId } from "../lib/sqlite-store.mjs";

const args = process.argv.slice(2);
const fromStore = args.includes("--from-store") || args[0] === "from-store";
const shouldStore = !args.includes("--no-store");
const createDrafts = args.includes("--drafts");

function optionNumber(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const parsed = Number(args[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

if (fromStore) {
  const result = buildNetworkingQueue({
    store: createStore(),
    limitJobs: optionNumber("--limit-jobs", optionNumber("--limit", 10)),
    limitContacts: optionNumber("--limit-contacts", 5),
    minRankScore: optionNumber("--min-rank-score", 1),
    createDrafts,
    requireResearch: args.includes("--require-research"),
    persist: shouldStore,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

const positional = args.filter((arg) => !arg.startsWith("--"));
const jobPath = positional[0];
const contactsPath = positional[1];

if (!jobPath || !contactsPath) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message:
          "Usage: node maxim/scripts/build-networking-shortlist.mjs job.json contacts.json [--no-store] OR --from-store [--drafts] [--require-research] [--limit-jobs N] [--limit-contacts N] [--no-store]",
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
const shortlist = rankContactsForJob(job, contacts).slice(0, optionNumber("--limit-contacts", contacts.length));
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
