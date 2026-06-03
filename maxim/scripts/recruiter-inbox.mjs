import { correctThreadTags, createRecruiterThread, markResponded } from "../lib/recruiter-inbox.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const command = process.argv[2] ?? "help";
const store = createStore();

function parseThread(value) {
  if (!value) {
    return {};
  }
  if (value.trim().startsWith("{")) {
    return JSON.parse(value);
  }
  const stored = store.getRecruiterThread(value);
  if (!stored) {
    throw new Error(`Recruiter thread not found: ${value}`);
  }
  return stored;
}

if (command === "create") {
  const subject = process.argv[3] ?? "Recruiter thread";
  const company = process.argv[4] ?? "";
  const thread = createRecruiterThread({ subject, company, tags: ["Needs Response"] });
  console.log(JSON.stringify({ ok: true, thread: store.upsertRecruiterThread(thread) }, null, 2));
} else if (command === "responded") {
  const thread = parseThread(process.argv[3]);
  console.log(JSON.stringify({ ok: true, thread: store.upsertRecruiterThread(markResponded(thread)) }, null, 2));
} else if (command === "correct") {
  const thread = parseThread(process.argv[3]);
  const tags = (process.argv[4] ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  console.log(JSON.stringify({ ok: true, thread: store.upsertRecruiterThread(correctThreadTags(thread, tags)) }, null, 2));
} else if (command === "needs-response") {
  console.log(JSON.stringify({ ok: true, threads: store.listRecruiterNeedsResponse() }, null, 2));
} else {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message:
          "Commands: create <subject> <company>, responded <thread-id-or-json>, correct <thread-id-or-json> <tag,csv>, needs-response",
      },
      null,
      2,
    ),
  );
}
