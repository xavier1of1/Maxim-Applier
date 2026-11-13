import test from "node:test";
import assert from "node:assert/strict";

import { classifyApplicationField, mapApplicationFormFields } from "../../lib/application-form-mapper.mjs";

const plan = {
  packet: { pdfPath: "output/xavier-role.pdf" },
  knownAnswers: {
    candidateName: "Xavier Kubancik",
    firstName: "Xavier",
    lastName: "Kubancik",
    email: "xavier@example.test",
    phone: "555-0100",
    location: "Northern Virginia / Washington, DC",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    linkedin: "https://linkedin.example/xavier",
    portfolioUrl: "https://portfolio.example",
    github: "https://github.example/xavier",
    country: "United States",
    educationSchool: "Virginia Tech",
    educationFieldOfStudy: "Computer Science",
    educationDegree: "",
    workAuthorization: "Yes",
    requiresSponsorship: "No",
    activeClearance: "No",
    willingToObtainClearance: "Yes",
    startDate: "Available with two weeks notice.",
    relocationOpen: "",
    smsConsent: "",
    applicationSource: "",
    previousEmployerRelationship: "",
    conflictOfInterest: "",
    exportControlRestrictions: "",
    usPerson: "",
    selfIdDefault: "",
    selfIdGender: "",
    selfIdRaceEthnicity: "",
    selfIdHispanicLatino: "",
    selfIdVeteranStatus: "",
    selfIdDisabilityStatus: "",
    expectedSalaryNumeric: 110000,
    expectedSalaryText: "Negotiable based on role scope and total compensation.",
  },
};

test("classifies common application fields", () => {
  assert.equal(classifyApplicationField({ label: "Email Address" }).category, "email");
  assert.equal(classifyApplicationField({ label: "Do you require visa sponsorship?" }).category, "sponsorship");
  assert.equal(classifyApplicationField({ label: "Do you have an active clearance?" }).category, "active_clearance");
  assert.equal(classifyApplicationField({ label: "Are you open to relocating?" }).category, "relocation");
  assert.equal(classifyApplicationField({ label: "Do you consent to SMS updates?" }).category, "sms_consent");
  assert.equal(classifyApplicationField({ label: "How did you hear about us?" }).category, "application_source");
  assert.equal(classifyApplicationField({ label: "Have you ever been employed by Anduril?" }).category, "previous_employer_relationship");
  assert.equal(classifyApplicationField({ label: "Conflict of Interest" }).category, "conflict_of_interest");
  assert.equal(classifyApplicationField({ label: "Export Controls" }).category, "export_control_restrictions");
  assert.equal(classifyApplicationField({ label: "Are you a U.S. person?" }).category, "us_person");
  assert.equal(classifyApplicationField({ label: "Veteran status" }).category, "self_id_veteran_status");
});

test("maps approved known fields to safe fill actions", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "text", label: "First Name", required: true },
      { index: 4, tagName: "input", type: "text", label: "Last Name", required: true },
      { index: 1, tagName: "input", type: "email", label: "Email", required: true },
      { index: 2, tagName: "select", label: "Are you authorized to work in the United States?", required: true },
      { index: 3, tagName: "input", type: "file", label: "Resume", required: true },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 5);
  assert.equal(mapped.requiredReviewCount, 0);
  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.action, item.value]),
    [
      ["first_name", "fill", "Xavier"],
      ["last_name", "fill", "Kubancik"],
      ["email", "fill", "xavier@example.test"],
      ["work_authorization", "select", "Yes"],
      ["resume_file", "attach_file", "output/xavier-role.pdf"],
    ],
  );
  assert.equal(mapped.stopBeforeFinalAction, true);
});

test("holds self-identification and unknown required fields for review", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "select", label: "Gender", required: true },
      { index: 1, tagName: "textarea", label: "Explain your most complex project", required: true },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.reviewCount, 2);
  assert.equal(mapped.requiredReviewCount, 2);
  assert.match(mapped.review.map((item) => item.reason).join("|"), /self_identification_requires_manual_review/);
  assert.match(mapped.review.map((item) => item.reason).join("|"), /unknown_required_field/);
});

test("fills configured standardized ATS answers only when explicitly provided", () => {
  const standardizedPlan = {
    ...plan,
    knownAnswers: {
      ...plan.knownAnswers,
      applicationSource: "Company careers page",
      previousEmployerRelationship: "No",
      conflictOfInterest: "No",
      exportControlRestrictions: "No",
      usPerson: "Yes",
    },
  };
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "text", label: "How did you hear about us?", required: true },
      { index: 1, tagName: "input", type: "text", label: "Have you ever been employed by Anduril?", required: true },
      { index: 2, tagName: "input", type: "text", label: "Conflict of Interest", required: true },
      { index: 3, tagName: "input", type: "text", label: "Export Controls", required: true },
      { index: 4, tagName: "input", type: "text", label: "Are you a U.S. person?", required: true },
    ],
    standardizedPlan,
  );

  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.value]),
    [
      ["application_source", "Company careers page"],
      ["previous_employer_relationship", "No"],
      ["conflict_of_interest", "No"],
      ["export_control_restrictions", "No"],
      ["us_person", "Yes"],
    ],
  );
  assert.equal(mapped.requiredReviewCount, 0);
});

test("fills configured self-identification defaults but keeps blanks in review", () => {
  const blankMapped = mapApplicationFormFields(
    [{ index: 0, tagName: "select", label: "Gender", required: false }],
    plan,
  );
  assert.equal(blankMapped.safeFillCount, 0);
  assert.equal(blankMapped.requiredReviewCount, 1);
  assert.equal(blankMapped.review[0].reason, "self_identification_requires_manual_review");

  const configuredMapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "select", label: "Gender", required: false },
      { index: 1, tagName: "select", label: "Veteran Status", required: false },
    ],
    { ...plan, knownAnswers: { ...plan.knownAnswers, selfIdDefault: "Prefer not to answer" } },
  );
  assert.deepEqual(
    configuredMapped.fillable.map((item) => [item.category, item.value]),
    [
      ["self_id_gender", "Prefer not to answer"],
      ["self_id_veteran_status", "Prefer not to answer"],
    ],
  );
  assert.equal(configuredMapped.requiredReviewCount, 0);
});

test("missing approved profile answers stay in review instead of being guessed", () => {
  const mapped = mapApplicationFormFields(
    [{ index: 0, tagName: "input", type: "email", label: "Email", required: true }],
    { ...plan, knownAnswers: { ...plan.knownAnswers, email: "" } },
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.reviewCount, 1);
  assert.equal(mapped.review[0].reason, "approved_answer_missing");
});

test("typed browser-native inputs are validated before fill", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "date", label: "Start Date", required: true },
      { index: 1, tagName: "input", type: "number", label: "Expected salary", required: true },
      { index: 2, tagName: "input", type: "url", label: "LinkedIn", required: true },
    ],
    plan,
  );

  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.value]),
    [
      ["salary", 110000],
      ["linkedin", "https://linkedin.example/xavier"],
    ],
  );
  assert.equal(mapped.review.length, 1);
  assert.equal(mapped.review[0].category, "start_date");
  assert.equal(mapped.review[0].reason, "typed_date_requires_manual_review");
});

test("invalid typed URL answers stay in review", () => {
  const mapped = mapApplicationFormFields(
    [{ index: 0, tagName: "input", type: "url", label: "LinkedIn", required: true }],
    { ...plan, knownAnswers: { ...plan.knownAnswers, linkedin: "linkedin.example/xavier" } },
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.review[0].reason, "typed_url_requires_manual_review");
});

test("relocation and SMS consent require explicit local preferences", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "text", label: "Are you open to relocating for a role?", required: true },
      { index: 1, tagName: "input", type: "text", label: "Do you consent to receiving text message updates?", required: true },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.deepEqual(
    mapped.review.map((item) => item.category),
    ["relocation", "sms_consent"],
  );
});

test("address fields require explicit private profile values", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "text", label: "Street Address", required: true },
      { index: 1, tagName: "input", type: "text", label: "City", required: true },
      { index: 2, tagName: "input", type: "text", label: "State", required: true },
      { index: 3, tagName: "input", type: "text", label: "Zip Code", required: true },
      { index: 4, tagName: "input", type: "text", label: "Current Location", required: true },
    ],
    plan,
  );

  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.value]),
    [["location", "Northern Virginia / Washington, DC"]],
  );
  assert.deepEqual(
    mapped.review.map((item) => [item.category, item.reason]),
    [
      ["street_address", "approved_answer_missing"],
      ["city", "approved_answer_missing"],
      ["state", "approved_answer_missing"],
      ["postal_code", "approved_answer_missing"],
    ],
  );
});

test("education fields fill only approved configured evidence", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "text", label: "University / College", required: true },
      { index: 1, tagName: "input", type: "text", label: "Major", required: true },
      { index: 2, tagName: "input", type: "text", label: "Degree", required: true },
    ],
    plan,
  );

  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.value]),
    [
      ["education_school", "Virginia Tech"],
      ["education_major", "Computer Science"],
    ],
  );
  assert.equal(mapped.review[0].category, "education_degree");
  assert.equal(mapped.review[0].reason, "approved_answer_missing");
});

test("maps radio and checkbox choices only when the approved option is explicit", () => {
  const choicePlan = {
    ...plan,
    knownAnswers: {
      ...plan.knownAnswers,
      relocationOpen: "Yes",
      smsConsent: "No",
    },
  };
  const mapped = mapApplicationFormFields(
    [
      {
        index: 0,
        tagName: "input",
        type: "radio",
        name: "sponsorship",
        value: "yes",
        groupLabel: "Will you now or in the future require employer visa sponsorship?",
        label: "Yes",
        required: true,
      },
      {
        index: 1,
        tagName: "input",
        type: "radio",
        name: "sponsorship",
        value: "no",
        groupLabel: "Will you now or in the future require employer visa sponsorship?",
        label: "No",
        required: true,
      },
      {
        index: 2,
        tagName: "input",
        type: "radio",
        name: "relocation",
        value: "yes",
        groupLabel: "Are you open to relocating for a role?",
        label: "Yes",
        required: true,
      },
      {
        index: 3,
        tagName: "input",
        type: "radio",
        name: "relocation",
        value: "no",
        groupLabel: "Are you open to relocating for a role?",
        label: "No",
        required: true,
      },
      {
        index: 4,
        tagName: "input",
        type: "radio",
        name: "sms",
        value: "yes",
        groupLabel: "Do you consent to SMS updates?",
        label: "Yes",
        required: true,
      },
      {
        index: 5,
        tagName: "input",
        type: "radio",
        name: "sms",
        value: "no",
        groupLabel: "Do you consent to SMS updates?",
        label: "No",
        required: true,
      },
      {
        index: 6,
        tagName: "input",
        type: "checkbox",
        name: "clearance_willing",
        value: "yes",
        groupLabel: "Are you willing to obtain a clearance?",
        label: "Yes",
        required: true,
      },
      {
        index: 7,
        tagName: "input",
        type: "checkbox",
        name: "clearance_willing",
        value: "no",
        groupLabel: "Are you willing to obtain a clearance?",
        label: "No",
        required: true,
      },
    ],
    choicePlan,
  );

  assert.equal(mapped.reviewCount, 0);
  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.action, item.field.index, item.value]),
    [
      ["sponsorship", "choose_option", 1, "No"],
      ["relocation", "choose_option", 2, "Yes"],
      ["sms_consent", "choose_option", 5, "No"],
      ["clearance_willing", "choose_option", 6, "Yes"],
    ],
  );
  assert.equal(mapped.skipped.filter((item) => item.reason === "choice_option_not_target").length, 4);
});

test("holds choice groups for review when no option clearly matches the approved answer", () => {
  const mapped = mapApplicationFormFields(
    [
      {
        index: 0,
        tagName: "input",
        type: "radio",
        name: "auth",
        value: "authorized",
        groupLabel: "Are you authorized to work in the United States?",
        label: "I am authorized",
        required: true,
      },
      {
        index: 1,
        tagName: "input",
        type: "radio",
        name: "auth",
        value: "unsure",
        groupLabel: "Are you authorized to work in the United States?",
        label: "Need review",
        required: true,
      },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.reviewCount, 1);
  assert.equal(mapped.review[0].category, "work_authorization");
  assert.equal(mapped.review[0].reason, "choice_option_requires_manual_review");
});

test("invisible helper fields are skipped instead of treated as application questions", () => {
  const mapped = mapApplicationFormFields(
    [{ index: 0, tagName: "input", type: "text", label: "", required: true, visible: false }],
    plan,
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.reviewCount, 0);
  assert.equal(mapped.skipped.length, 1);
});

test("hidden labeled file inputs are attachable for styled resume uploads", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "file", label: "Resume", required: true, visible: false },
      { index: 1, tagName: "input", type: "text", label: "Invisible helper", required: false, visible: false },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 1);
  assert.equal(mapped.fillable[0].category, "resume_file");
  assert.equal(mapped.fillable[0].action, "attach_file");
  assert.equal(mapped.skipped.length, 1);
});

test("file inputs inside hidden future steps are skipped until visible", () => {
  const mapped = mapApplicationFormFields(
    [
      {
        index: 0,
        tagName: "input",
        type: "file",
        label: "Resume",
        required: true,
        visible: false,
        hiddenAncestor: true,
      },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.reviewCount, 0);
  assert.equal(mapped.skipped[0].reason, "disabled_or_readonly");
});

test("unlabeled helper fields are skipped instead of guessed", () => {
  const mapped = mapApplicationFormFields(
    [{ index: 0, tagName: "input", type: "input", label: "", required: true, visible: true }],
    plan,
  );

  assert.equal(mapped.safeFillCount, 0);
  assert.equal(mapped.reviewCount, 0);
  assert.equal(mapped.skipped[0].reason, "unlabeled_unaddressable_field");
});

test("non-choice group labels do not override direct field labels", () => {
  const mapped = mapApplicationFormFields(
    [
      { index: 0, tagName: "input", type: "text", groupLabel: "Phone", label: "Country", required: true, visible: true },
      { index: 1, tagName: "input", type: "input", groupLabel: "Phone", label: "", required: true, visible: true },
      { index: 2, tagName: "input", type: "tel", groupLabel: "Phone", label: "Phone", required: true, visible: true },
    ],
    plan,
  );

  assert.deepEqual(
    mapped.fillable.map((item) => [item.category, item.value]),
    [
      ["country", "United States"],
      ["phone", "555-0100"],
    ],
  );
  assert.equal(mapped.skipped[0].reason, "unlabeled_unaddressable_field");
});

test("nearby context labels can identify unlabeled ATS fields", () => {
  const mapped = mapApplicationFormFields(
    [
      {
        index: 0,
        tagName: "input",
        type: "email",
        contextLabel: "Email Address",
        required: true,
        visible: true,
      },
      {
        index: 1,
        tagName: "input",
        type: "text",
        contextLabel: "This field is intentionally generic",
        required: false,
        visible: true,
      },
    ],
    plan,
  );

  assert.equal(mapped.safeFillCount, 1);
  assert.equal(mapped.fillable[0].category, "email");
  assert.equal(mapped.review[0].reason, "unknown_optional_field");
});
