import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

import { chromium } from "playwright";

import { markAssistedApplyStarted } from "../lib/application-tracker.mjs";
import { buildAutoApplyPlan, loadAutoApplyProfile } from "../lib/auto-apply-planner.mjs";
import { mapApplicationFormFields } from "../lib/application-form-mapper.mjs";
import { fromRoot } from "../lib/path-utils.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const command = process.argv[2] ?? "help";
const FIELD_ACTION_TIMEOUT_MS = 5000;

function readFlag(name) {
  return process.argv.includes(name);
}

function readOption(name, fallback = undefined) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) {
    return exact.slice(name.length + 1);
  }
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readPositiveIntegerOption(name, fallback) {
  const value = Number.parseInt(readOption(name, ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function fail(message) {
  console.log(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
}

function resolveLocalPath(maybePath) {
  if (!maybePath) {
    return undefined;
  }
  return path.isAbsolute(maybePath) ? maybePath : fromRoot(maybePath);
}

async function loadPlan(applicationId) {
  const store = createStore();
  const application = store.getApplication(applicationId);
  if (!application) {
    fail(`Application not found: ${applicationId}`);
  }
  return { store, application, plan: buildAutoApplyPlan(application, { profile: loadAutoApplyProfile() }) };
}

function recordStarted(store, application, result) {
  const stored = store.upsertApplication(markAssistedApplyStarted(application));
  store.appendAuditEvent({
    event_type: "application_browser_assist_started",
    entity_type: "application",
    entity_id: stored.id,
    reason: "Guided browser assist filled known-safe fields and stopped for Xavier review",
    payload: {
      company: stored.company,
      role: stored.role,
      fieldCount: result.fieldCount,
      safeFillCount: result.mapping?.safeFillCount,
      reviewCount: result.mapping?.reviewCount,
      stopReasons: result.stopReasons ?? [],
      finalAction: result.finalAction,
    },
  });
  return stored;
}

export function startRecordDecision(result) {
  if (!result?.ok) {
    return { record: false, reason: "run_not_ok" };
  }
  if ((result.stopReasons ?? []).length > 0) {
    return { record: false, reason: "stopped_on_platform_or_posting_condition" };
  }
  const filledCount = result.applied?.filter((item) => item.filled).length ?? 0;
  if (filledCount === 0) {
    return { record: false, reason: "no_known_fields_filled" };
  }
  return { record: true, reason: "known_fields_filled" };
}

export async function extractFields(page) {
  const fields = [];
  const frames = page.frames();
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const frameFields = await frame.locator("input, textarea, select").evaluateAll((elements) =>
      elements.map((element, index) => {
        function textByIds(value) {
          return String(value ?? "")
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.innerText.trim() ?? "")
            .filter(Boolean)
            .join(" ");
        }
        function cleanContextText(value) {
          return String(value ?? "")
            .replace(/\s+/g, " ")
            .replace(/\*/g, "")
            .trim();
        }
        function cloneTextWithoutControls(node) {
          const clone = node.cloneNode(true);
          clone.querySelectorAll("input, textarea, select, button, option, script, style").forEach((child) => child.remove());
          return cleanContextText(clone.innerText || clone.textContent || "");
        }
        function nearbyContextText(element) {
          const directReference = textByIds(element.getAttribute("aria-labelledby"));
          if (directReference) {
            return directReference;
          }
          const previous = element.previousElementSibling;
          if (previous && !previous.matches("input, textarea, select, button")) {
            const previousText = cleanContextText(previous.innerText || previous.textContent || "");
            if (previousText && previousText.length <= 160) {
              return previousText;
            }
          }
          for (const container of [element.parentElement, element.parentElement?.parentElement]) {
            if (!container || container === document.body) {
              continue;
            }
            const text = cloneTextWithoutControls(container);
            if (text && text.length <= 200) {
              return text;
            }
          }
          return "";
        }
        const labels = Array.from(element.labels ?? []).map((label) => label.innerText.trim()).filter(Boolean);
        const fieldset = element.closest("fieldset");
        const ariaGroup = element.closest("[role='radiogroup'], [role='group']");
        const groupElement = fieldset ?? ariaGroup;
        const groupLabel =
          fieldset?.querySelector("legend")?.innerText.trim()
          || textByIds(groupElement?.getAttribute("aria-labelledby"))
          || groupElement?.getAttribute("aria-label")
          || "";
        const groupRequired =
          groupElement?.getAttribute("aria-required") === "true" || groupElement?.hasAttribute("required") || false;
        const tagName = element.tagName.toLowerCase();
        const rect = element.getBoundingClientRect();
        let hiddenAncestor = false;
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const style = window.getComputedStyle(parent);
          if (parent.hidden || style.display === "none" || style.visibility === "hidden") {
            hiddenAncestor = true;
            break;
          }
        }
        return {
          index,
          tagName,
          type: element.getAttribute("type") ?? tagName,
          id: element.id,
          name: element.getAttribute("name") ?? "",
          value: element.getAttribute("value") ?? "",
          groupLabel,
          label: labels.join(" "),
          contextLabel: nearbyContextText(element),
          ariaLabel: element.getAttribute("aria-label") ?? "",
          placeholder: element.getAttribute("placeholder") ?? "",
          required: element.required || element.getAttribute("aria-required") === "true" || groupRequired,
          disabled: element.disabled,
          readOnly: element.readOnly,
          visible: rect.width > 0 && rect.height > 0,
          hiddenAncestor,
          options:
            tagName === "select"
              ? Array.from(element.options).map((option) => ({ label: option.label, value: option.value }))
              : [],
        };
      }),
    ).catch(() => []);
    fields.push(
      ...frameFields.map((field) => ({
        ...field,
        frameIndex,
        frameName: frame.name(),
        frameUrl: frame.url(),
      })),
    );
  }
  return fields;
}

async function visibleFieldCount(page) {
  let total = 0;
  for (const frame of page.frames()) {
    total += await frame
      .locator("input:not([type='hidden']), textarea, select")
      .evaluateAll((elements) => elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length)
      .catch(() => 0);
  }
  return total;
}

export async function revealApplicationForm(page) {
  const visibleFields = await visibleFieldCount(page);
  if (visibleFields > 0) {
    return { attempted: false, reason: "fields_already_visible", visibleFieldCount: visibleFields };
  }

  const triggers = page.locator("a, button").filter({ hasText: /apply/i });
  const count = Math.min(await triggers.count().catch(() => 0), 8);
  for (let index = 0; index < count; index += 1) {
    const trigger = triggers.nth(index);
    const text = (await trigger.innerText().catch(() => "")).trim();
    if (!text || /(?:submit|send|finish|complete)/i.test(text)) {
      continue;
    }
    const popupPromise = page.waitForEvent("popup", { timeout: 3000 }).catch(() => undefined);
    await trigger.click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
      await popup.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      return { attempted: true, clickedText: text, openedPopup: true, targetPage: popup };
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    return { attempted: true, clickedText: text };
  }
  return { attempted: false, reason: "no_safe_apply_launcher_found" };
}

function normalizeControlText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isProhibitedFinalControlText(text) {
  return /\b(?:submit|send|finish|complete|finalize|apply now|send application|submit application|complete application)\b/i.test(text);
}

function isSafeContinuationText(text) {
  const normalized = normalizeControlText(text).toLowerCase();
  if (!normalized || isProhibitedFinalControlText(normalized)) {
    return false;
  }
  return [
    "next",
    "continue",
    "save and continue",
    "save & continue",
    "continue application",
    "continue to next step",
    "next step",
  ].includes(normalized);
}

async function collectControls(page) {
  const controls = [];
  const frames = page.frames();
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const frameControls = await frame
      .locator("button, a, input[type='button'], input[type='submit']")
      .evaluateAll((elements) =>
        elements.map((element, index) => {
          const rect = element.getBoundingClientRect();
          const tagName = element.tagName.toLowerCase();
          const text = [
            element.innerText,
            element.getAttribute("value"),
            element.getAttribute("aria-label"),
            element.getAttribute("title"),
          ]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          return {
            index,
            tagName,
            type: element.getAttribute("type") ?? tagName,
            text,
            visible: rect.width > 0 && rect.height > 0,
            disabled: element.disabled || element.getAttribute("aria-disabled") === "true",
          };
        }),
      )
      .catch(() => []);
    controls.push(
      ...frameControls.map((control) => ({
        ...control,
        frameIndex,
        frameName: frame.name(),
        frameUrl: frame.url(),
      })),
    );
  }
  return controls;
}

export async function detectFinalActionControls(page) {
  return (await collectControls(page))
    .filter((control) => control.visible && !control.disabled && isProhibitedFinalControlText(control.text))
    .map(({ index, tagName, type, text, frameIndex, frameName, frameUrl }) => ({
      index,
      tagName,
      type,
      text,
      frameIndex,
      frameName,
      frameUrl,
    }));
}

export async function findSafeContinuationControl(page) {
  const controls = await collectControls(page);
  return controls
    .filter((control) => control.visible && !control.disabled && isSafeContinuationText(control.text))
    .map(({ index, tagName, type, text, frameIndex, frameName, frameUrl }) => ({
      index,
      tagName,
      type,
      text,
      frameIndex,
      frameName,
      frameUrl,
    }))[0];
}

async function clickSafeContinuationControl(page, control) {
  const frame = frameForField(page, control);
  const locator = frame.locator("button, a, input[type='button'], input[type='submit']").nth(control.index);
  await locator.click();
  await page.waitForLoadState("domcontentloaded", { timeout: 7000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
  await page.waitForTimeout(700);
}

export async function detectStopPage(page) {
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const lower = text.toLowerCase();
  const reasons = [];
  if (lower.includes("captcha") || lower.includes("verify you are human")) {
    reasons.push("platform_challenge_or_human_verification");
  }
  if (lower.includes("sign in") || lower.includes("log in")) {
    reasons.push("login_required");
  }
  if (lower.includes("couldn't find anything here") || lower.includes("job posting") && lower.includes("closed") || lower.includes("404 error")) {
    reasons.push("posting_unavailable_or_removed");
  }
  return reasons;
}

function cssAttrValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function selectorForTagAttr(tagNames, attr, value) {
  const escaped = cssAttrValue(value);
  return tagNames.map((tagName) => `${tagName}[${attr}="${escaped}"]`).join(", ");
}

function normalizeOptionText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function answerAliases(value) {
  const normalized = normalizeOptionText(value);
  if (["yes", "y", "true", "1"].includes(normalized)) {
    return new Set(["yes", "y", "true"]);
  }
  if (["no", "n", "false", "0"].includes(normalized)) {
    return new Set(["no", "n", "false"]);
  }
  if (["united states", "usa", "us", "u s", "united states of america"].includes(normalized)) {
    return new Set(["united states", "united states of america", "usa", "us", "u s"]);
  }
  return new Set([normalized].filter(Boolean));
}

function optionText(option) {
  return normalizeOptionText([option.label, option.value].filter(Boolean).join(" "));
}

function optionMatchesAnswer(option, aliases) {
  const label = normalizeOptionText(option.label);
  const value = normalizeOptionText(option.value);
  const combined = optionText(option);
  for (const alias of aliases) {
    if (!alias) {
      continue;
    }
    if (label === alias || value === alias || combined === alias) {
      return true;
    }
    if ((alias === "yes" || alias === "no") && (label.startsWith(`${alias} `) || value.startsWith(`${alias} `))) {
      return true;
    }
  }
  return false;
}

function selectOptionForAnswer(field, answer) {
  const aliases = answerAliases(answer);
  const matches = (field.options ?? [])
    .filter((option) => normalizeOptionText(option.label || option.value))
    .filter((option) => optionMatchesAnswer(option, aliases));
  return matches.length === 1 ? matches[0] : undefined;
}

async function uniqueOrUndefined(locator) {
  const count = await locator.count().catch(() => 0);
  return count === 1 ? locator.first() : undefined;
}

function frameForField(page, field) {
  const frames = page.frames();
  if (Number.isInteger(field.frameIndex) && frames[field.frameIndex]) {
    return frames[field.frameIndex];
  }
  if (field.frameUrl) {
    const byUrl = frames.find((frame) => frame.url() === field.frameUrl);
    if (byUrl) {
      return byUrl;
    }
  }
  if (field.frameName) {
    const byName = frames.find((frame) => frame.name() === field.frameName);
    if (byName) {
      return byName;
    }
  }
  return page.mainFrame();
}

export async function locatorForField(page, field) {
  const frame = frameForField(page, field);
  const tagNames = ["input", "textarea", "select"];
  if (field.id) {
    const byId = await uniqueOrUndefined(frame.locator(selectorForTagAttr(tagNames, "id", field.id)));
    if (byId) {
      return byId;
    }
  }

  const type = String(field.type ?? "").toLowerCase();
  if (field.name && field.value && ["checkbox", "radio"].includes(type)) {
    const byNameValue = await uniqueOrUndefined(
      frame.locator(`input[name="${cssAttrValue(field.name)}"][value="${cssAttrValue(field.value)}"]`),
    );
    if (byNameValue) {
      return byNameValue;
    }
  }

  if (field.name && !["checkbox", "radio"].includes(type)) {
    const byName = await uniqueOrUndefined(frame.locator(selectorForTagAttr(tagNames, "name", field.name)));
    if (byName) {
      return byName;
    }
  }

  return frame.locator("input, textarea, select").nth(field.index);
}

export async function applyKnownField(page, item) {
  const locator = await locatorForField(page, item.field);
  if (item.action === "fill") {
    await locator.fill(String(item.value), { timeout: FIELD_ACTION_TIMEOUT_MS });
    return { category: item.category, action: item.action, filled: true };
  }
  if (item.action === "select") {
    const value = String(item.value);
    const matchedOption = selectOptionForAnswer(item.field, value);
    if (matchedOption) {
      await locator.selectOption({ value: matchedOption.value }, { timeout: FIELD_ACTION_TIMEOUT_MS });
      return { category: item.category, action: item.action, filled: true, selectedLabel: matchedOption.label };
    }
    try {
      await locator.selectOption({ label: value }, { timeout: FIELD_ACTION_TIMEOUT_MS });
    } catch {
      await locator.selectOption({ value }, { timeout: FIELD_ACTION_TIMEOUT_MS });
    }
    return { category: item.category, action: item.action, filled: true };
  }
  if (item.action === "attach_file") {
    const filePath = resolveLocalPath(item.value);
    if (!filePath || !fs.existsSync(filePath)) {
      return { category: item.category, action: item.action, filled: false, reason: "attachment_missing" };
    }
    await locator.setInputFiles(filePath, { timeout: FIELD_ACTION_TIMEOUT_MS });
    return { category: item.category, action: item.action, filled: true, filePath };
  }
  if (item.action === "choose_option") {
    await locator.check({ timeout: FIELD_ACTION_TIMEOUT_MS });
    return {
      category: item.category,
      action: item.action,
      filled: true,
      optionLabel: item.field?.label ?? "",
      choiceGroup: item.choiceGroup,
    };
  }
  return { category: item.category, action: item.action, filled: false, reason: "choice_field_requires_review" };
}

export async function safelyApplyKnownField(page, item) {
  try {
    return await applyKnownField(page, item);
  } catch (error) {
    return {
      category: item.category,
      action: item.action,
      filled: false,
      reason: "field_application_failed",
      message: String(error?.message ?? error).split("\n")[0].slice(0, 240),
    };
  }
}

function redactValue(category, value) {
  if (["email", "phone", "linkedin", "street_address", "city", "state", "postal_code"].includes(category)) {
    return "[configured]";
  }
  if (category === "resume_file") {
    return "[configured-file]";
  }
  return value;
}

function redactMapping(mapping) {
  if (!mapping) {
    return mapping;
  }
  return {
    ...mapping,
    fillable: mapping.fillable.map((item) => ({
      ...item,
      value: redactValue(item.category, item.value),
    })),
  };
}

function redactApplied(applied = []) {
  return applied.map((item) => {
    const clean = { ...item };
    if (clean.filePath) {
      clean.filePath = "[configured-file]";
    }
    return clean;
  });
}

export function redactResult(result) {
  if (!result?.mapping) {
    return result;
  }
  return {
    ...result,
    mapping: redactMapping(result.mapping),
    applied: redactApplied(result.applied),
    steps: result.steps?.map((step) => ({
      ...step,
      mapping: redactMapping(step.mapping),
      applied: redactApplied(step.applied),
    })) ?? [],
  };
}

export function buildReviewSummary(result) {
  const reviewFields = result?.mapping?.review?.map((item) => ({
    category: item.category,
    label:
      item.field?.label
      || item.field?.contextLabel
      || item.field?.ariaLabel
      || item.field?.placeholder
      || item.field?.id
      || item.field?.name
      || "",
    required: Boolean(item.field?.required),
    reason: item.reason,
  })) ?? [];
  const failedFields = result?.applied
    ?.filter((item) => item.filled === false)
    .map((item) => ({
      category: item.category,
      action: item.action,
      reason: item.reason,
      message: item.message,
    })) ?? [];
  return {
    ok: Boolean(result?.ok),
    url: result?.url,
    finalAction: result?.finalAction,
    stopReasons: result?.stopReasons ?? [],
    fieldCount: result?.fieldCount ?? 0,
    safeFillCount: result?.mapping?.safeFillCount ?? 0,
    reviewCount: result?.mapping?.reviewCount ?? 0,
    requiredReviewCount: result?.mapping?.requiredReviewCount ?? 0,
    appliedCount: result?.applied?.filter((item) => item.filled).length ?? 0,
    failedApplyCount: result?.applied?.filter((item) => item.filled === false).length ?? 0,
    stepCount: result?.steps?.length ?? 0,
    finalActionControls: result?.finalActionControls ?? [],
    reviewFields,
    failedFields,
  };
}

export function buildReviewChecklist(result) {
  const summary = buildReviewSummary(result);
  const requiredFields = summary.reviewFields.filter((field) => field.required || field.category === "self_identification");
  const optionalFields = summary.reviewFields.filter((field) => !field.required && field.category !== "self_identification");
  const nextManualActions = [];

  if (summary.stopReasons.length > 0) {
    nextManualActions.push("Resolve the platform/posting stop condition before continuing.");
  }
  if (requiredFields.length > 0) {
    nextManualActions.push("Answer required review fields manually before moving forward.");
  }
  if (summary.failedFields.length > 0) {
    nextManualActions.push("Check failed field applications and fill them manually if still required.");
  }
  if (summary.finalActionControls.length > 0) {
    nextManualActions.push("Review the page and complete any final submit/apply action manually.");
  }
  if (nextManualActions.length === 0) {
    nextManualActions.push("Review the page manually before taking any final application action.");
  }

  return {
    requiredFields,
    optionalFields,
    failedFields: summary.failedFields,
    finalActionControls: summary.finalActionControls,
    stopReasons: summary.stopReasons,
    nextManualActions,
  };
}

function combineMappings(mappings) {
  const fillable = mappings.flatMap((mapping) => mapping.fillable ?? []);
  const review = mappings.flatMap((mapping) => mapping.review ?? []);
  const skipped = mappings.flatMap((mapping) => mapping.skipped ?? []);
  const requiredReview = review.filter((item) => item.field.required || item.category === "self_identification");
  return {
    ok: mappings.every((mapping) => mapping.ok),
    totalFields: mappings.reduce((sum, mapping) => sum + (mapping.totalFields ?? 0), 0),
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

export function writeRunReport({
  applicationId,
  command,
  result,
  recordedStarted = false,
  now = new Date(),
  outputDir = fromRoot("data", "maxim", "auto-apply-runs"),
}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `${timestamp}-${applicationId}-${command}.json`);
  const payload = {
    ok: Boolean(result?.ok),
    applicationId,
    command,
    recordedStarted,
    generatedAt: now.toISOString(),
    summary: buildReviewSummary(result),
    reviewChecklist: buildReviewChecklist(result),
    result: redactResult(result),
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outputPath;
}

function cleanRevealResult(reveal) {
  if (!reveal?.targetPage) {
    return reveal;
  }
  const { targetPage, ...safeReveal } = reveal;
  return safeReveal;
}

export async function runBrowserPlan(
  plan,
  {
    fillKnownFields = false,
    force = readFlag("--force"),
    headed = readFlag("--headed"),
    close = readFlag("--close"),
    maxSteps = readPositiveIntegerOption("--max-steps", 4),
  } = {},
) {
  if (!plan.jobUrl) {
    return { ok: false, message: "Plan has no job URL.", plan };
  }
  if (!plan.ready && !force) {
    return { ok: false, message: "Plan is not ready. Use --force only for inspection.", plan };
  }

  const browser = await chromium.launch({ headless: !headed });
  let page = await browser.newPage();
  const applied = [];
  const steps = [];
  try {
    await page.goto(plan.jobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const revealResult = await revealApplicationForm(page);
    if (revealResult.targetPage) {
      page = revealResult.targetPage;
    }
    const reveal = cleanRevealResult(revealResult);
    let finalAction = "stopped_for_xavier_review";
    let finalActionControls = [];

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      const stopReasons = await detectStopPage(page);
      const fields = await extractFields(page);
      const mapping = mapApplicationFormFields(fields, plan);
      const stepApplied = [];
      const step = {
        index: stepIndex + 1,
        url: page.url(),
        stopReasons,
        fieldCount: fields.length,
        mapping,
        applied: stepApplied,
        finalActionControls: await detectFinalActionControls(page),
      };
      steps.push(step);

      if (fillKnownFields && stopReasons.length === 0) {
        for (const item of mapping.fillable) {
          const result = await safelyApplyKnownField(page, item);
          stepApplied.push(result);
          applied.push(result);
          await page.waitForTimeout(350);
        }
      }

      finalActionControls = await detectFinalActionControls(page);
      step.finalActionControls = finalActionControls;

      if (stopReasons.length > 0) {
        finalAction = "stopped_on_platform_or_posting_condition";
        break;
      }
      if (!fillKnownFields) {
        finalAction = "inspection_complete_stopped_for_xavier_review";
        break;
      }
      if (mapping.requiredReviewCount > 0) {
        finalAction = "stopped_for_xavier_review";
        break;
      }

      const continuation = await findSafeContinuationControl(page);
      if (!continuation) {
        finalAction = "stopped_for_xavier_review";
        break;
      }
      step.continuation = continuation;
      await clickSafeContinuationControl(page, continuation);

      if (stepIndex === maxSteps - 1) {
        finalAction = "stopped_after_max_steps";
      }
    }

    const combinedMapping = combineMappings(steps.map((step) => step.mapping));
    const finalStep = steps[steps.length - 1];
    return {
      ok: true,
      url: page.url(),
      reveal,
      stopReasons: finalStep?.stopReasons ?? [],
      fieldCount: combinedMapping.totalFields,
      mapping: combinedMapping,
      applied,
      steps,
      finalActionControls,
      finalAction,
    };
  } finally {
    if (!headed || close) {
      await browser.close();
    }
  }
}

async function main() {
  if (command === "inspect" || command === "assist") {
    const applicationId = process.argv[3];
    if (!applicationId) {
      fail(`Usage: npm run maxim:auto-apply-browser -- ${command} <application-id> [--headed] [--force] [--record-started] [--write-report] [--max-steps N]`);
    }
    const { store, application, plan } = await loadPlan(applicationId);
    const result = await runBrowserPlan(plan, { fillKnownFields: command === "assist" });
    const startDecision = startRecordDecision(result);
    const shouldRecordStarted = command === "assist" && readFlag("--record-started") && startDecision.record;
    const recordedApplication =
      shouldRecordStarted ? recordStarted(store, application, result) : undefined;
    const reportPath = readFlag("--write-report")
      ? writeRunReport({ applicationId, command, result, recordedStarted: Boolean(recordedApplication) })
      : undefined;
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          command,
          recordedStarted: Boolean(recordedApplication),
          recordStartedDecision: startDecision,
          applicationStatus: recordedApplication?.status,
          reportPath,
          summary: buildReviewSummary(result),
          reviewChecklist: buildReviewChecklist(result),
          result: redactResult(result),
        },
        null,
        2,
      ),
    );
    process.exit(result.ok ? 0 : 1);
  }

  console.log(
    JSON.stringify(
      {
        ok: false,
        message:
          "Commands: inspect <application-id> [--headed] [--force] [--write-report] [--max-steps N], assist <application-id> [--headed] [--force] [--record-started] [--write-report] [--max-steps N]. The runner fills known fields only, may follow safe Next/Continue steps, and stops for Xavier review before any final application action.",
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
