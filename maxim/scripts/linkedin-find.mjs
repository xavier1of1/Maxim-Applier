import fs from "node:fs";

import { buildLinkedInConnectionDiscovery, parseLinkedInPeopleText } from "../lib/linkedin-connection-finder.mjs";
import { rankContactsForJob } from "../lib/contact-ranker.mjs";
import { buildNetworkingQueue, normalizeNetworkingJob } from "../lib/networking-workflow.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const args = process.argv.slice(2);

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function optionNumber(name, fallback) {
  const value = optionValue(name);
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalFile(flag) {
  const filePath = optionValue(flag);
  return filePath ? fs.readFileSync(filePath, "utf8") : "";
}

function printUsage() {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message:
          "Usage: npm run maxim:linkedin-find -- --company \"Company\" --role \"Role\" [--results pasted.txt] [--store-results] [--queue] OR --from-store [--limit-jobs N]",
        examples: [
          "npm run maxim:linkedin-find -- --company Palantir --role \"Forward Deployed Software Engineer\"",
          "npm run maxim:linkedin-find -- --from-store --limit-jobs 3 --results data\\maxim\\linkedin-results.txt --store-results --queue",
        ],
      },
      null,
      2,
    ),
  );
}

function jobDTO(row) {
  return normalizeNetworkingJob({
    id: row.id ?? row.job_id,
    company: row.company,
    role: row.role,
    tier: row.tier,
    score: row.career_ops_score,
    jobUrl: row.job_url,
    source: row.source,
    priorityOverlay: row.priority_overlay,
  });
}

const fromStore = args.includes("--from-store");
const storeResults = args.includes("--store-results");
const queueTargets = args.includes("--queue");
const debug = args.includes("--debug");
const limitJobs = optionNumber("--limit-jobs", optionNumber("--limit", 5));
const limitContacts = optionNumber("--limit-contacts", 8);
const pastedText = readOptionalFile("--results") || readOptionalFile("--pasted-results");
const store = createStore();

let jobs = [];
if (fromStore) {
  jobs = store.listNetworkingEligibleJobs({ limit: limitJobs }).map(jobDTO);
} else if (optionValue("--job-id")) {
  const storedJob = store.getJob(optionValue("--job-id"));
  if (!storedJob) {
    console.log(JSON.stringify({ ok: false, message: "Job not found.", jobId: optionValue("--job-id") }, null, 2));
    process.exit(1);
  }
  jobs = [jobDTO(storedJob)];
} else if (optionValue("--company") || optionValue("--role")) {
  jobs = [
    normalizeNetworkingJob({
      company: optionValue("--company") ?? "",
      role: optionValue("--role") ?? "",
    }),
  ];
}

if (jobs.length === 0) {
  printUsage();
  process.exit(1);
}

const localContacts = store.listContacts();
const parsedContacts = parseLinkedInPeopleText(pastedText);
let storedParsedContacts = 0;
if (storeResults) {
  for (const contact of parsedContacts) {
    store.upsertContact(contact);
    storedParsedContacts += 1;
  }
}

const candidateContacts = [...localContacts, ...parsedContacts];
const discoveries = jobs.map((job) => {
  const explicitRankedCandidates = rankContactsForJob(job, candidateContacts)
    .slice(0, limitContacts)
    .map((item) => ({
      contact: item.contact,
      rankScore: item.rankScore,
      rankingReason: item.rankingReason,
    }));
  const discovery = buildLinkedInConnectionDiscovery({
    job,
    contacts: candidateContacts,
    pastedText,
    limit: limitContacts,
  });
  return {
    ...discovery,
    rankedCandidates: explicitRankedCandidates.length > 0 ? explicitRankedCandidates : discovery.rankedCandidates,
  };
});

let queued = null;
if (queueTargets) {
  const queueContacts = storeResults ? store.listContacts() : candidateContacts;
  queued = buildNetworkingQueue({
    store,
    jobs,
    contacts: queueContacts,
    limitJobs: jobs.length,
    limitContacts,
    createDrafts: args.includes("--drafts"),
    requireResearch: args.includes("--require-research"),
    persist: !args.includes("--no-store"),
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: fromStore ? "store_jobs" : "single_job",
      jobsConsidered: jobs.length,
      localContactsConsidered: localContacts.length,
      parsedContacts: parsedContacts.length,
      storedParsedContacts,
      queued,
      discoveries,
      debug: debug
        ? {
            firstJob: jobs[0] ?? null,
            firstParsedContact: parsedContacts[0] ?? null,
            explicitRankPreview: jobs[0] ? rankContactsForJob(jobs[0], candidateContacts).slice(0, 3) : [],
            candidateContacts: candidateContacts.length,
          }
        : undefined,
      safety: {
        linkedinLoginRequired: false,
        linkedinSending: "not_implemented",
        scraping: "not_implemented",
        manualReviewRequired: true,
      },
    },
    null,
    2,
  ),
);
