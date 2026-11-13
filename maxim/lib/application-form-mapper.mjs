const SELF_ID_PATTERNS = [
  /\b(?:race|ethnicity|gender|disability|veteran|pronouns|sexual orientation)\b/i,
  /\b(?:eeo|equal employment|demographic)\b/i,
];

const SELF_ID_RULES = [
  { category: "self_id_gender", patterns: [/\bgender\b/i], answer: (plan) => plan.knownAnswers.selfIdGender || plan.knownAnswers.selfIdDefault },
  {
    category: "self_id_race_ethnicity",
    patterns: [/\brace|ethnicity|ethnic\b/i],
    answer: (plan) => plan.knownAnswers.selfIdRaceEthnicity || plan.knownAnswers.selfIdDefault,
  },
  {
    category: "self_id_hispanic_latino",
    patterns: [/\bhispanic|latino|latina|latinx\b/i],
    answer: (plan) => plan.knownAnswers.selfIdHispanicLatino || plan.knownAnswers.selfIdDefault,
  },
  {
    category: "self_id_veteran_status",
    patterns: [/\bveteran|armed forces|military service\b/i],
    answer: (plan) => plan.knownAnswers.selfIdVeteranStatus || plan.knownAnswers.selfIdDefault,
  },
  {
    category: "self_id_disability_status",
    patterns: [/\bdisability|disabled\b/i],
    answer: (plan) => plan.knownAnswers.selfIdDisabilityStatus || plan.knownAnswers.selfIdDefault,
  },
];

const FIELD_RULES = [
  { category: "first_name", patterns: [/\bfirst\s*name\b/i], answer: (plan) => plan.knownAnswers.firstName },
  { category: "last_name", patterns: [/\blast\s*name\b/i, /\bsurname\b/i], answer: (plan) => plan.knownAnswers.lastName },
  { category: "preferred_name", patterns: [/\bpreferred\s*(?:first\s*)?name\b/i], answer: (plan) => plan.knownAnswers.firstName },
  { category: "full_name", patterns: [/\bfull\s*name\b/i, /\bname\b/i], answer: (plan) => plan.knownAnswers.candidateName },
  { category: "email", patterns: [/\be-?mail\b/i], answer: (plan) => plan.knownAnswers.email },
  { category: "phone", patterns: [/\bphone|mobile|cell\b/i], answer: (plan) => plan.knownAnswers.phone },
  { category: "linkedin", patterns: [/\blinkedin\b/i], answer: (plan) => plan.knownAnswers.linkedin },
  { category: "portfolio", patterns: [/\bportfolio|website|personal\s*site\b/i], answer: (plan) => plan.knownAnswers.portfolioUrl },
  { category: "github", patterns: [/\bgithub\b/i], answer: (plan) => plan.knownAnswers.github },
  { category: "country", patterns: [/\bcountry\b/i], answer: (plan) => plan.knownAnswers.country },
  { category: "street_address", patterns: [/\bstreet\s+address|address\s+line|mailing\s+address|home\s+address\b/i], answer: (plan) => plan.knownAnswers.streetAddress },
  { category: "postal_code", patterns: [/\bzip|postal\s+code\b/i], answer: (plan) => plan.knownAnswers.postalCode },
  { category: "state", patterns: [/\bstate\b|\bprovince\b/i], answer: (plan) => plan.knownAnswers.state },
  { category: "city", patterns: [/\bcity\b/i], answer: (plan) => plan.knownAnswers.city },
  { category: "location", patterns: [/\blocation|where\s+are\s+you\s+located|current\s+address\b/i], answer: (plan) => plan.knownAnswers.location },
  { category: "education_school", patterns: [/\bschool|university|college\b/i], answer: (plan) => plan.knownAnswers.educationSchool },
  { category: "education_major", patterns: [/\bmajor|field\s+of\s+study|area\s+of\s+study\b/i], answer: (plan) => plan.knownAnswers.educationFieldOfStudy },
  { category: "education_degree", patterns: [/\bdegree|highest\s+education|education\s+level\b/i], answer: (plan) => plan.knownAnswers.educationDegree },
  { category: "located_us", patterns: [/\bcurrently\s+located.*united\s+states|located.*u\.?s\.?\b/i], answer: () => "Yes" },
  { category: "relocation", patterns: [/\brelocat(?:e|ing|ion)\b/i], answer: (plan) => plan.knownAnswers.relocationOpen },
  { category: "work_authorization", patterns: [/\bauthorized.*work|work.*authorization|u\.?s\.?\s*citizen\b/i], answer: (plan) => plan.knownAnswers.workAuthorization },
  { category: "sponsorship", patterns: [/\bsponsor|sponsorship|visa\b/i], answer: (plan) => plan.knownAnswers.requiresSponsorship },
  { category: "active_clearance", patterns: [/\bactive\s+clearance|current\s+clearance|security\s+clearance\b/i], answer: (plan) => plan.knownAnswers.activeClearance },
  { category: "clearance_willing", patterns: [/\bwilling.*clearance|eligible.*clearance|obtain.*clearance\b/i], answer: (plan) => plan.knownAnswers.willingToObtainClearance },
  { category: "start_date", patterns: [/\bstart\s*date|available|availability\b/i], answer: (plan) => plan.knownAnswers.startDate },
  { category: "salary", patterns: [/\bsalary|compensation|pay\b/i], answer: (plan) => plan.knownAnswers.expectedSalaryNumeric ?? plan.knownAnswers.expectedSalaryText },
  { category: "sms_consent", patterns: [/\btext\s+message|sms\b/i], answer: (plan) => plan.knownAnswers.smsConsent },
  { category: "application_source", patterns: [/\bhow did you hear|source\b/i], answer: (plan) => plan.knownAnswers.applicationSource },
  {
    category: "previous_employer_relationship",
    patterns: [/\bpreviously employed|ever been employed|worked for.*(?:company|anduril)|company.*acquired\b/i],
    answer: (plan) => plan.knownAnswers.previousEmployerRelationship,
  },
  {
    category: "conflict_of_interest",
    patterns: [/\bconflict of interest|conflicting interest\b/i],
    answer: (plan) => plan.knownAnswers.conflictOfInterest,
  },
  {
    category: "export_control_restrictions",
    patterns: [/\bexport control|export controls|restricted party|sanctions\b/i],
    answer: (plan) => plan.knownAnswers.exportControlRestrictions,
  },
  {
    category: "us_person",
    patterns: [/\bu\.?s\.?\s+person|united states person|u\.?s\.?\s+citizen.*export\b/i],
    answer: (plan) => plan.knownAnswers.usPerson,
  },
  { category: "resume_file", patterns: [/\bresume|cv\b/i], answer: (plan) => plan.packet.pdfPath },
  { category: "cover_letter", patterns: [/\bcover\s*letter\b/i], answer: () => "" },
];

function isChoiceField(field) {
  const type = String(field.type ?? "").toLowerCase();
  return type === "checkbox" || type === "radio";
}

function isFileField(field) {
  return String(field.type ?? "").toLowerCase() === "file";
}

function fieldText(field) {
  return [
    isChoiceField(field) ? field.groupLabel : "",
    field.label,
    field.contextLabel,
    field.name,
    field.id,
    field.placeholder,
    field.ariaLabel,
    field.type,
  ]
    .filter(Boolean)
    .join(" ");
}

function fieldIdentityText(field) {
  return [
    isChoiceField(field) ? field.groupLabel : "",
    field.label,
    field.contextLabel,
    field.name,
    field.id,
    field.placeholder,
    field.ariaLabel,
  ].filter(Boolean).join(" ");
}

export function classifyApplicationField(field) {
  const text = fieldText(field);
  for (const rule of SELF_ID_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { category: rule.category, confidence: "medium", sensitive: true, rule };
    }
  }
  if (SELF_ID_PATTERNS.some((pattern) => pattern.test(text))) {
    return { category: "self_identification", confidence: "high", sensitive: true };
  }
  for (const rule of FIELD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { category: rule.category, confidence: "medium", rule };
    }
  }
  return { category: "unknown", confidence: "low" };
}

function actionFor(field, category) {
  const type = String(field.type ?? "").toLowerCase();
  const tagName = String(field.tagName ?? field.tag ?? "input").toLowerCase();
  if (category === "resume_file" || isFileField(field)) {
    return "attach_file";
  }
  if (tagName === "select") {
    return "select";
  }
  if (isChoiceField(field)) {
    return "choose_option";
  }
  return "fill";
}

function answerFor(classification, plan) {
  return classification.rule?.answer?.(plan);
}

function isSensitiveSelfIdCategory(category) {
  return category === "self_identification" || String(category ?? "").startsWith("self_id_");
}

function typedInputReviewReason(field, value) {
  const type = String(field.type ?? "").toLowerCase();
  const text = String(value ?? "").trim();
  if (!["date", "month", "number", "email", "tel", "url"].includes(type)) {
    return "";
  }
  if (type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "typed_date_requires_manual_review";
  }
  if (type === "month" && !/^\d{4}-\d{2}$/.test(text)) {
    return "typed_month_requires_manual_review";
  }
  if (type === "number" && !/^-?\d+(?:\.\d+)?$/.test(text)) {
    return "typed_number_requires_manual_review";
  }
  if (type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
    return "typed_email_requires_manual_review";
  }
  if (type === "url" && !/^https?:\/\/\S+\.\S+$/i.test(text)) {
    return "typed_url_requires_manual_review";
  }
  return "";
}

function normalizeChoiceText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function answerTokens(value) {
  const normalized = normalizeChoiceText(value);
  if (["yes", "y", "true", "1"].includes(normalized)) {
    return ["yes", "y", "true"];
  }
  if (["no", "n", "false", "0"].includes(normalized)) {
    return ["no", "n", "false"];
  }
  return [normalized].filter(Boolean);
}

function choiceOptionText(field) {
  return normalizeChoiceText([field.label, field.value, field.ariaLabel, field.placeholder].filter(Boolean).join(" "));
}

function choiceGroupKey(field) {
  const groupIdentity = field.name || field.groupLabel || field.id;
  return [
    String(field.type ?? "").toLowerCase(),
    groupIdentity,
  ]
    .filter(Boolean)
    .join("::");
}

function choiceMatchesAnswer(field, answer) {
  const optionText = choiceOptionText(field);
  if (!optionText) {
    return false;
  }
  return answerTokens(answer).some((token) => optionText === token || optionText.split(" ").includes(token));
}

function addChoiceGroup({ group, fillable, review, skipped }) {
  const target = group.items.find((item) => choiceMatchesAnswer(item.field, item.value));
  if (target) {
    fillable.push({
      field: target.field,
      category: target.category,
      action: target.action,
      value: target.value,
      confidence: target.confidence,
      choiceGroup: group.key,
    });
    for (const item of group.items) {
      if (item !== target) {
        skipped.push({ field: item.field, reason: "choice_option_not_target" });
      }
    }
    return;
  }

  const representative = group.items[0];
  review.push({
    field: representative.field,
    category: representative.category,
    reason: "choice_option_requires_manual_review",
  });
}

function addChoiceReviewGroup({ group, review, skipped }) {
  const representative = group.items[0];
  review.push({
    field: representative.field,
    category: representative.category,
    reason: representative.reason,
  });
  for (const item of group.items.slice(1)) {
    skipped.push({ field: item.field, reason: "choice_review_duplicate_option" });
  }
}

export function mapApplicationFormFields(fields, plan) {
  const fillable = [];
  const review = [];
  const skipped = [];
  const choiceGroups = new Map();
  const choiceReviewGroups = new Map();

  function deferChoiceReview(field, category, reason) {
    const action = actionFor(field, category);
    if (action !== "choose_option") {
      review.push({ field, category, reason });
      return;
    }
    const key = choiceGroupKey(field);
    const group = choiceReviewGroups.get(key) ?? { key, items: [] };
    group.items.push({ field, category, reason });
    choiceReviewGroups.set(key, group);
  }

  for (const field of fields) {
    if (field.disabled || field.readOnly || (field.visible === false && (!isFileField(field) || field.hiddenAncestor))) {
      skipped.push({ field, reason: "disabled_or_readonly" });
      continue;
    }
    if (!fieldIdentityText(field).trim()) {
      skipped.push({ field, reason: "unlabeled_unaddressable_field" });
      continue;
    }
    const classification = classifyApplicationField(field);
    if (classification.category === "self_identification") {
      deferChoiceReview(field, classification.category, "self_identification_requires_manual_review");
      continue;
    }
    if (classification.category === "cover_letter") {
      deferChoiceReview(field, classification.category, "cover_letter_requires_role_specific_review");
      continue;
    }
    if (classification.category === "unknown") {
      deferChoiceReview(field, classification.category, field.required ? "unknown_required_field" : "unknown_optional_field");
      continue;
    }
    const value = answerFor(classification, plan);
    if (value === undefined || value === null || String(value).trim() === "") {
      deferChoiceReview(
        field,
        classification.category,
        isSensitiveSelfIdCategory(classification.category) ? "self_identification_requires_manual_review" : "approved_answer_missing",
      );
      continue;
    }
    const action = actionFor(field, classification.category);
    const typedReviewReason = action === "fill" ? typedInputReviewReason(field, value) : "";
    if (typedReviewReason) {
      review.push({ field, category: classification.category, reason: typedReviewReason });
      continue;
    }
    if (action === "choose_option") {
      const key = choiceGroupKey(field);
      const group = choiceGroups.get(key) ?? { key, items: [] };
      group.items.push({
        field,
        category: classification.category,
        action,
        value,
        confidence: classification.confidence,
      });
      choiceGroups.set(key, group);
      continue;
    }
    fillable.push({
      field,
      category: classification.category,
      action,
      value,
      confidence: classification.confidence,
    });
  }

  for (const group of choiceGroups.values()) {
    addChoiceGroup({ group, fillable, review, skipped });
  }
  for (const group of choiceReviewGroups.values()) {
    addChoiceReviewGroup({ group, review, skipped });
  }

  const requiredReview = review.filter((item) => item.field.required || isSensitiveSelfIdCategory(item.category));
  return {
    ok: true,
    totalFields: fields.length,
    safeFillCount: fillable.length,
    reviewCount: review.length,
    requiredReviewCount: requiredReview.length,
    fillable,
    review,
    skipped,
    stopBeforeFinalAction: true,
    readyForKnownFieldFill: fillable.length > 0,
    readyForFinalReview: requiredReview.length === 0,
  };
}
