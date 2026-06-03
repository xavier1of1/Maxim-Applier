import { correctThreadTags, createRecruiterThread, markResponded } from "../lib/recruiter-inbox.mjs";

const command = process.argv[2] ?? "help";
if (command === "create") {
  const subject = process.argv[3] ?? "Recruiter thread";
  const company = process.argv[4] ?? "";
  console.log(JSON.stringify(createRecruiterThread({ subject, company, tags: ["Needs Response"] }), null, 2));
} else if (command === "responded") {
  const thread = JSON.parse(process.argv[3] ?? "{}");
  console.log(JSON.stringify(markResponded(thread), null, 2));
} else if (command === "correct") {
  const thread = JSON.parse(process.argv[3] ?? "{}");
  const tags = (process.argv[4] ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  console.log(JSON.stringify(correctThreadTags(thread, tags), null, 2));
} else {
  console.log(JSON.stringify({ ok: false, message: "Commands: create <subject> <company>, responded <thread-json>, correct <thread-json> <tag,csv>" }, null, 2));
}
