import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildLinkedInConnectionDiscovery,
  buildLinkedInSearchTasks,
  inferRoleLane,
  parseLinkedInPeopleText,
} from "../../lib/linkedin-connection-finder.mjs";

const fixturePath = path.resolve("maxim/tests/fixtures/linkedin-people-results.txt");

test("infers role lane keywords for FDE and software roles", () => {
  assert.deepEqual(inferRoleLane("Forward Deployed Software Engineer").slice(0, 3), [
    "software",
    "engineer",
    "fde",
  ]);
});

test("builds manual LinkedIn research search tasks without account automation", () => {
  const tasks = buildLinkedInSearchTasks({
    company: "Federal Platform Labs",
    role: "Software Engineer, Mission Systems",
  });
  assert.equal(tasks.length, 5);
  assert.equal(tasks.every((task) => task.manualOnly), true);
  assert.equal(tasks.some((task) => task.type === "recruiter"), true);
  assert.equal(tasks.some((task) => task.type === "hiring_manager"), true);
  assert.equal(tasks.some((task) => task.type === "vt_alumni"), true);
  assert.match(tasks[0].publicSearchUrl, /^https:\/\/www\.google\.com\/search/);
  assert.match(tasks[0].linkedinPeopleSearchUrl, /^https:\/\/www\.linkedin\.com\/search\/results\/people/);
});

test("parses pasted LinkedIn people results into contact candidates", () => {
  const contacts = parseLinkedInPeopleText(fs.readFileSync(fixturePath, "utf8"));
  assert.equal(contacts.length, 3);
  assert.equal(contacts[0].name, "Morgan Recruiter");
  assert.equal(contacts[0].company, "Federal Platform Labs");
  assert.equal(contacts[0].connectionStrength, 1);
  assert.equal(contacts[0].recruiterSignal, true);
  assert.equal(contacts[1].vtAlumni, true);
  assert.equal(contacts[2].founderSignal, true);
  assert.match(contacts[0].linkedinUrl, /linkedin\.com\/in\/morgan-recruiter/);
});

test("discovery combines local contacts, pasted contacts, ranked candidates, and search tasks", () => {
  const result = buildLinkedInConnectionDiscovery({
    job: { company: "Federal Platform Labs", role: "Software Engineer, Mission Systems" },
    contacts: [
      {
        name: "Taylor Local",
        company: "Federal Platform Labs",
        title: "Director of Engineering",
        connectionStrength: 2,
        roleRelevance: "software engineering",
      },
    ],
    pastedText: fs.readFileSync(fixturePath, "utf8"),
    limit: 5,
  });
  assert.equal(result.ok, true);
  assert.equal(result.safety.linkedinSending, "not_implemented");
  assert.equal(result.parsedContacts.length, 3);
  assert.equal(result.localMatches.length >= 1, true);
  assert.equal(result.rankedCandidates.length >= 3, true);
  assert.equal(result.searchTasks.length, 5);
});

