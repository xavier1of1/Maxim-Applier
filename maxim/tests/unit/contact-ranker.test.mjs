import test from "node:test";
import assert from "node:assert/strict";

import { rankContactsForJob } from "../../lib/contact-ranker.mjs";

test("software roles do not make unrelated contacts relevant by themselves", () => {
  const ranked = rankContactsForJob(
    { company: "Federal Platform Labs", role: "Software Engineer" },
    [{ name: "Unrelated Contact", company: "Elsewhere", title: "Sales Representative" }],
  );
  assert.equal(ranked.length, 0);
});

test("ranking includes company, connection, alumni, recruiter, founder, seniority, and role signals", () => {
  const [top] = rankContactsForJob(
    { company: "Federal Platform Labs", role: "Software Engineer, Mission Systems" },
    [
      {
        name: "Morgan Lead",
        company: "Federal Platform Labs",
        title: "Principal Software Engineering Manager",
        connectionStrength: 3,
        vtAlumni: true,
        recruiterSignal: true,
        founderSignal: true,
        roleRelevance: "federal software automation",
      },
    ],
  );
  assert.equal(top.rankScore, 131);
  assert.match(top.rankingReason, /Same company/);
  assert.match(top.rankingReason, /Seniority/);
});

