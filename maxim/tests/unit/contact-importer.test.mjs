import test from "node:test";
import assert from "node:assert/strict";

import { parseContactsCsv } from "../../lib/contact-importer.mjs";

test("contact CSV importer preserves ranking signals", () => {
  const contacts = parseContactsCsv(`name,company,title,linkedin_url,email,connection_strength,vt_alumni,recruiter_signal,founder_signal,role_relevance,source,notes
"A, Person",Acme,Founder,https://example.invalid,,3,true,false,true,software,fixture,"quoted, notes"
Recruiter,Acme,Technical Recruiter,,,2,false,true,false,automation,fixture,`);

  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].name, "A, Person");
  assert.equal(contacts[0].connectionStrength, 3);
  assert.equal(contacts[0].vtAlumni, true);
  assert.equal(contacts[0].founderSignal, true);
  assert.equal(contacts[0].notes, "quoted, notes");
  assert.equal(contacts[1].recruiterSignal, true);
});
