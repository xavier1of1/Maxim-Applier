import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import {
  buildReviewChecklist,
  buildReviewSummary,
  redactResult,
  runBrowserPlan,
  safelyApplyKnownField,
  startRecordDecision,
  writeRunReport,
} from "../../scripts/auto-apply-browser.mjs";
import { fromRoot } from "../../lib/path-utils.mjs";

function writeFixturePage(tmp) {
  const pagePath = path.join(tmp, "application.html");
  fs.writeFileSync(
    pagePath,
    `<!doctype html>
<html>
  <body>
    <button id="launch" type="button">Apply for this job</button>
    <form id="application" style="display:none">
      <label for="first_name">First Name</label>
      <input id="first_name" name="first_name" required>

      <label for="last_name">Last Name</label>
      <input id="last_name" name="last_name" required>

      <label for="email">Email</label>
      <input id="email" name="email" type="email" required>

      <label for="phone">Phone</label>
      <input id="phone" name="phone" required>

      <label for="country">Country</label>
      <select id="country" name="country" required>
        <option value="">Choose</option>
        <option value="US">United States of America</option>
        <option value="CA">Canada</option>
      </select>

      <label for="linkedin">LinkedIn</label>
      <input id="linkedin" name="linkedin">

      <label for="auth">Are you authorized to work in the United States?</label>
      <select id="auth" name="auth" required>
        <option value="">Choose</option>
        <option value="authorized_yes">Yes, I am authorized</option>
        <option value="No">No</option>
      </select>

      <label for="sponsor">Will you now or in the future require visa sponsorship?</label>
      <select id="sponsor" name="sponsor" required>
        <option value="">Choose</option>
        <option value="Yes">Yes</option>
        <option value="sponsor_no">No, I do not require sponsorship</option>
      </select>

      <label for="clearance">Do you have an active clearance?</label>
      <select id="clearance" name="clearance" required>
        <option value="">Choose</option>
        <option value="Yes">Yes</option>
        <option value="clearance_no">No active clearance</option>
      </select>

      <label for="start_date">Start Date</label>
      <input id="start_date" name="start_date" type="date" required>

      <label for="resume">Resume</label>
      <input id="resume" name="resume" type="file" required style="display:none">

      <label for="veteran">Veteran status</label>
      <select id="veteran" name="veteran" required>
        <option value="">Choose</option>
        <option value="Prefer not to answer">Prefer not to answer</option>
      </select>

      <button type="submit">Submit Application</button>
    </form>
    <script>
      document.getElementById("launch").addEventListener("click", () => {
        document.getElementById("application").style.display = "block";
      });
      document.getElementById("first_name").addEventListener("input", () => {
        if (document.getElementById("dynamic_helper")) {
          return;
        }
        const helper = document.createElement("input");
        helper.id = "dynamic_helper";
        helper.setAttribute("aria-label", "Dynamic helper field");
        document.getElementById("resume").before(helper);
      });
    </script>
  </body>
</html>
`,
    "utf8",
  );
  return pagePath;
}

function writeChoiceFixturePage(tmp) {
  const pagePath = path.join(tmp, "choice-application.html");
  fs.writeFileSync(
    pagePath,
    `<!doctype html>
<html>
  <body>
    <form id="application">
      <div role="radiogroup" aria-labelledby="auth_label" aria-required="true">
        <p id="auth_label">Are you currently authorized to work in the United States?</p>
        <label><input type="radio" name="auth" value="yes" required> Yes</label>
        <label><input type="radio" name="auth" value="no" required> No</label>
      </div>

      <fieldset>
        <legend>Will you now or in the future require employer visa sponsorship?</legend>
        <label><input type="radio" name="sponsor" value="yes" required> Yes</label>
        <label><input type="radio" name="sponsor" value="no" required> No</label>
      </fieldset>

      <fieldset>
        <legend>Do you have an active clearance?</legend>
        <label><input type="radio" name="clearance" value="yes" required> Yes</label>
        <label><input type="radio" name="clearance" value="no" required> No</label>
      </fieldset>

      <fieldset>
        <legend>Are you open to relocating for a role?</legend>
        <label><input type="radio" name="relocation" value="yes" required> Yes</label>
        <label><input type="radio" name="relocation" value="no" required> No</label>
      </fieldset>

      <fieldset>
        <legend>Do you consent to SMS updates?</legend>
        <label><input type="radio" name="sms" value="yes" required> Yes</label>
        <label><input type="radio" name="sms" value="no" required> No</label>
      </fieldset>

      <fieldset>
        <legend>Are you willing to obtain a clearance?</legend>
        <label><input type="checkbox" name="clearance_willing" value="yes" required> Yes</label>
        <label><input type="checkbox" name="clearance_willing" value="no" required> No</label>
      </fieldset>

      <fieldset>
        <legend>Veteran status</legend>
        <label><input type="radio" name="veteran" value="yes" required> Yes</label>
        <label><input type="radio" name="veteran" value="no" required> No</label>
      </fieldset>
    </form>
  </body>
</html>
`,
    "utf8",
  );
  return pagePath;
}

function writeMultiStepFixturePage(tmp) {
  const pagePath = path.join(tmp, "multi-step-application.html");
  fs.writeFileSync(
    pagePath,
    `<!doctype html>
<html>
  <body>
    <form id="application">
      <section id="step1">
        <label for="first_name">First Name</label>
        <input id="first_name" name="first_name" required>

        <label for="email">Email</label>
        <input id="email" name="email" type="email" required>

        <button id="next" type="button">Next</button>
      </section>
      <section id="step2" style="display:none">
        <label for="salary">Expected salary</label>
        <input id="salary" name="salary" type="number" required>

        <label for="resume">Resume</label>
        <input id="resume" name="resume" type="file" required>

        <fieldset>
          <legend>Veteran status</legend>
          <label><input type="radio" name="veteran" value="yes" required> Yes</label>
          <label><input type="radio" name="veteran" value="no" required> No</label>
        </fieldset>

        <button id="submit" type="submit">Submit Application</button>
      </section>
    </form>
    <script>
      document.getElementById("next").addEventListener("click", () => {
        document.getElementById("step1").style.display = "none";
        document.getElementById("step2").style.display = "block";
      });
      document.getElementById("application").addEventListener("submit", (event) => {
        event.preventDefault();
        document.body.setAttribute("data-submitted", "true");
      });
    </script>
  </body>
</html>
`,
    "utf8",
  );
  return pagePath;
}

function writeContextLabelFixturePage(tmp) {
  const pagePath = path.join(tmp, "context-label-application.html");
  fs.writeFileSync(
    pagePath,
    `<!doctype html>
<html>
  <body>
    <form>
      <div class="field">
        <div>Email Address</div>
        <input required>
      </div>
      <div class="field">
        <div>Phone Number</div>
        <input required>
      </div>
      <button type="submit">Submit Application</button>
    </form>
  </body>
</html>
`,
    "utf8",
  );
  return pagePath;
}

function writePopupFixturePages(tmp) {
  const formPath = path.join(tmp, "popup-form.html");
  fs.writeFileSync(
    formPath,
    `<!doctype html>
<html>
  <body>
    <form>
      <label for="first_name">First Name</label>
      <input id="first_name" name="first_name" required>

      <label for="email">Email</label>
      <input id="email" name="email" type="email" required>

      <label for="resume">Resume</label>
      <input id="resume" name="resume" type="file" required>

      <button type="submit">Submit Application</button>
    </form>
  </body>
</html>
`,
    "utf8",
  );

  const launcherPath = path.join(tmp, "job-page.html");
  fs.writeFileSync(
    launcherPath,
    `<!doctype html>
<html>
  <body>
    <a id="apply" href="${pathToFileURL(formPath).href}" target="_blank">Apply for this job</a>
  </body>
</html>
`,
    "utf8",
  );
  return launcherPath;
}

function writeIframeFixturePages(tmp) {
  const formPath = path.join(tmp, "iframe-form.html");
  fs.writeFileSync(
    formPath,
    `<!doctype html>
<html>
  <body>
    <form>
      <label for="first_name">First Name</label>
      <input id="first_name" name="first_name" required>

      <label for="email">Email</label>
      <input id="email" name="email" type="email" required>

      <label for="auth">Are you authorized to work in the United States?</label>
      <select id="auth" name="auth" required>
        <option value="">Choose</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>

      <label for="resume">Resume</label>
      <input id="resume" name="resume" type="file" required>

      <button type="submit">Submit Application</button>
    </form>
  </body>
</html>
`,
    "utf8",
  );

  const hostPath = path.join(tmp, "iframe-host.html");
  fs.writeFileSync(
    hostPath,
    `<!doctype html>
<html>
  <body>
    <iframe title="Application form" src="${pathToFileURL(formPath).href}" style="width:800px;height:600px"></iframe>
  </body>
</html>
`,
    "utf8",
  );
  return hostPath;
}

function fixturePlan(jobUrl) {
  return {
    ready: true,
    jobUrl,
    packet: {
      pdfPath: fromRoot("maxim", "tests", "fixtures", "output", "federal-platform-labs-software-engineer.pdf"),
    },
    knownAnswers: {
      candidateName: "Xavier Kubancik",
      firstName: "Xavier",
      lastName: "Kubancik",
      email: "xavier@example.test",
      phone: "555-0100",
      location: "Northern Virginia / Washington, DC",
      linkedin: "https://linkedin.example/xavier",
      portfolioUrl: "",
      github: "",
      country: "United States",
      workAuthorization: "Yes",
      requiresSponsorship: "No",
      activeClearance: "No",
      willingToObtainClearance: "Yes",
      startDate: "Available with two weeks notice.",
      expectedSalaryNumeric: 100000,
      expectedSalaryText: "Negotiable based on role scope and total compensation.",
      relocationOpen: "",
      smsConsent: "",
    },
  };
}

function choiceFixturePlan(jobUrl) {
  const plan = fixturePlan(jobUrl);
  return {
    ...plan,
    knownAnswers: {
      ...plan.knownAnswers,
      relocationOpen: "Yes",
      smsConsent: "No",
    },
  };
}

test("browser guided apply fills approved fields, attaches resume, and stops for review", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-browser-fixture-"));
  const pagePath = writeFixturePage(tmp);
  const result = await runBrowserPlan(fixturePlan(pathToFileURL(pagePath).href), {
    fillKnownFields: true,
    force: false,
    headed: false,
    close: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reveal.attempted, true);
  assert.equal(result.finalAction, "stopped_for_xavier_review");
  assert.equal(result.stopReasons.length, 0);
  assert.equal(result.mapping.safeFillCount, 10);
  assert.equal(result.mapping.requiredReviewCount, 2);
  assert.equal(result.mapping.review.find((item) => item.category === "self_id_veteran_status").reason, "self_identification_requires_manual_review");
  assert.equal(result.mapping.review.find((item) => item.category === "start_date").reason, "typed_date_requires_manual_review");

  const applied = result.applied.filter((item) => item.filled).map((item) => item.category).sort();
  assert.deepEqual(applied, [
    "active_clearance",
    "country",
    "email",
    "first_name",
    "last_name",
    "linkedin",
    "phone",
    "resume_file",
    "sponsorship",
    "work_authorization",
  ]);
  assert.equal(result.applied.find((item) => item.category === "country").selectedLabel, "United States of America");
  assert.equal(result.applied.find((item) => item.category === "sponsorship").selectedLabel, "No, I do not require sponsorship");

  const clean = redactResult(result);
  assert.equal(clean.mapping.fillable.find((item) => item.category === "email").value, "[configured]");
  assert.equal(clean.mapping.fillable.find((item) => item.category === "phone").value, "[configured]");
  assert.equal(clean.mapping.fillable.find((item) => item.category === "linkedin").value, "[configured]");
  assert.equal(clean.applied.find((item) => item.category === "resume_file").filePath, "[configured-file]");

  const summary = buildReviewSummary(result);
  assert.equal(summary.appliedCount, 10);
  assert.equal(summary.reviewFields.length, 2);
  assert.match(summary.reviewFields.map((item) => item.reason).join("|"), /self_identification_requires_manual_review/);
  assert.match(summary.reviewFields.map((item) => item.reason).join("|"), /typed_date_requires_manual_review/);
  assert.deepEqual(startRecordDecision(result), { record: true, reason: "known_fields_filled" });
  const checklist = buildReviewChecklist(result);
  assert.deepEqual(
    checklist.requiredFields.map((item) => item.category).sort(),
    ["self_id_veteran_status", "start_date"],
  );
  assert.match(checklist.nextManualActions.join("|"), /Answer required review fields manually/);
  assert.match(checklist.nextManualActions.join("|"), /complete any final submit\/apply action manually/);

  const reportPath = writeRunReport({
    applicationId: "app_fixture",
    command: "assist",
    result,
    outputDir: path.join(tmp, "reports"),
    now: new Date("2026-06-03T12:00:00.000Z"),
  });
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.summary.appliedCount, 10);
  assert.equal(report.reviewChecklist.requiredFields.length, 2);
  assert.equal(report.result.mapping.fillable.find((item) => item.category === "email").value, "[configured]");
});

test("browser started recording requires an actual successful fill", () => {
  assert.deepEqual(startRecordDecision({ ok: false }), { record: false, reason: "run_not_ok" });
  assert.deepEqual(
    startRecordDecision({ ok: true, stopReasons: ["login_required"], applied: [{ filled: true }] }),
    { record: false, reason: "stopped_on_platform_or_posting_condition" },
  );
  assert.deepEqual(startRecordDecision({ ok: true, stopReasons: [], applied: [] }), {
    record: false,
    reason: "no_known_fields_filled",
  });
});

test("browser guided apply follows safe apply launcher popups", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-browser-popup-fixture-"));
  const launcherPath = writePopupFixturePages(tmp);
  const result = await runBrowserPlan(fixturePlan(pathToFileURL(launcherPath).href), {
    fillKnownFields: true,
    force: false,
    headed: false,
    close: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reveal.openedPopup, true);
  assert.match(result.url, /popup-form\.html$/);
  assert.equal(result.mapping.safeFillCount, 3);
  assert.equal(result.mapping.requiredReviewCount, 0);
  assert.deepEqual(
    result.applied.filter((item) => item.filled).map((item) => item.category),
    ["first_name", "email", "resume_file"],
  );
});

test("browser guided apply fills embedded iframe forms", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-browser-iframe-fixture-"));
  const hostPath = writeIframeFixturePages(tmp);
  const result = await runBrowserPlan(fixturePlan(pathToFileURL(hostPath).href), {
    fillKnownFields: true,
    force: false,
    headed: false,
    close: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reveal.reason, "fields_already_visible");
  assert.equal(result.mapping.safeFillCount, 4);
  assert.equal(result.mapping.requiredReviewCount, 0);
  assert.equal(result.mapping.fillable.every((item) => item.field.frameIndex > 0), true);
  assert.equal(result.finalActionControls[0].text, "Submit Application");
  assert.equal(result.finalActionControls[0].frameIndex > 0, true);
  assert.deepEqual(
    result.applied.filter((item) => item.filled).map((item) => item.category),
    ["first_name", "email", "work_authorization", "resume_file"],
  );
});

test("browser guided apply checks only matching approved radio choices", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-browser-choice-fixture-"));
  const pagePath = writeChoiceFixturePage(tmp);
  const result = await runBrowserPlan(choiceFixturePlan(pathToFileURL(pagePath).href), {
    fillKnownFields: true,
    force: false,
    headed: false,
    close: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapping.safeFillCount, 6);
  assert.equal(result.mapping.requiredReviewCount, 1);
  assert.equal(result.mapping.review[0].category, "self_id_veteran_status");

  const applied = result.applied.filter((item) => item.filled).map((item) => [item.category, item.optionLabel]);
  assert.deepEqual(applied, [
    ["work_authorization", "Yes"],
    ["sponsorship", "No"],
    ["active_clearance", "No"],
    ["relocation", "Yes"],
    ["sms_consent", "No"],
    ["clearance_willing", "Yes"],
  ]);
});

test("browser guided apply advances safe multi-step forms but stops before submit", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-browser-multistep-fixture-"));
  const pagePath = writeMultiStepFixturePage(tmp);
  const result = await runBrowserPlan(fixturePlan(pathToFileURL(pagePath).href), {
    fillKnownFields: true,
    force: false,
    headed: false,
    close: true,
    maxSteps: 4,
  });

  assert.equal(result.ok, true);
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].continuation.text, "Next");
  assert.equal(result.finalAction, "stopped_for_xavier_review");
  assert.deepEqual(
    result.applied.filter((item) => item.filled).map((item) => item.category),
    ["first_name", "email", "salary", "resume_file"],
  );
  assert.equal(result.mapping.requiredReviewCount, 1);
  assert.equal(result.mapping.review[0].category, "self_id_veteran_status");
  assert.equal(result.finalActionControls[0].text, "Submit Application");

  const clean = redactResult(result);
  assert.equal(clean.steps[0].mapping.fillable.find((item) => item.category === "email").value, "[configured]");
  assert.equal(clean.steps[1].mapping.fillable.find((item) => item.category === "resume_file").value, "[configured-file]");
});

test("browser guided apply uses nearby context labels for unlabeled ATS fields", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-browser-context-fixture-"));
  const pagePath = writeContextLabelFixturePage(tmp);
  const result = await runBrowserPlan(fixturePlan(pathToFileURL(pagePath).href), {
    fillKnownFields: true,
    force: false,
    headed: false,
    close: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.mapping.safeFillCount, 2);
  assert.deepEqual(
    result.applied.filter((item) => item.filled).map((item) => item.category),
    ["email", "phone"],
  );
  assert.equal(result.mapping.fillable.find((item) => item.category === "email").field.contextLabel, "Email Address");
  assert.equal(result.mapping.fillable.find((item) => item.category === "phone").field.contextLabel, "Phone Number");
  assert.equal(result.finalActionControls[0].text, "Submit Application");
});

test("browser guided apply records field application failures without throwing", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`<input id="email" name="email" type="email">`);
    const result = await safelyApplyKnownField(page, {
      category: "country",
      action: "select",
      value: "United States",
      field: {
        index: 0,
        id: "email",
        tagName: "select",
        type: "select",
        options: [{ label: "United States", value: "US" }],
      },
    });

    assert.equal(result.filled, false);
    assert.equal(result.reason, "field_application_failed");
    assert.match(result.message, /select/i);
    const failedRun = { ok: true, mapping: {}, applied: [result] };
    assert.equal(buildReviewSummary(failedRun).failedApplyCount, 1);
    assert.equal(buildReviewChecklist(failedRun).failedFields[0].category, "country");
    assert.match(buildReviewChecklist(failedRun).nextManualActions.join("|"), /failed field applications/);
  } finally {
    await browser.close();
  }
});
