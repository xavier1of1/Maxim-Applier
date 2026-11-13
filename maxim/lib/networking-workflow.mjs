import { rankContactsForJob } from "./contact-ranker.mjs";
import { buildNetworkingDraft, validateMessageDraft } from "./message-builder.mjs";
import { createStore, stableId } from "./sqlite-store.mjs";

export const MANUAL_MESSAGE_STATUSES = [
  "ready_to_send",
  "sent_manually",
  "replied",
  "follow_up_due",
  "referral_asked",
  "referred",
  "declined",
  "no_response",
];

const TARGET_STATUSES_SAFE_TO_PROMOTE = new Set(["ready_to_research", "ready_to_send"]);

function bool(value) {
  if (typeof value === "string") {
    return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function assertManualMessageStatus(status) {
  if (!MANUAL_MESSAGE_STATUSES.includes(status)) {
    throw new Error(`Unsupported networking status: ${status}`);
  }
  return status;
}

export function normalizeNetworkingJob(job = {}) {
  const company = job.company ?? job.job_company ?? "";
  const role = job.role ?? job.title ?? job.job_role ?? "";
  const jobUrl = job.jobUrl ?? job.job_url ?? job.url ?? "";
  return {
    ...job,
    id: job.id ?? job.jobId ?? job.job_id ?? stableId("job", `${company}|${role}|${jobUrl}`),
    company,
    role,
    title: role,
    tier: job.tier ?? job.maxim_tier ?? job.job_tier ?? "",
    score: numberOrNull(job.score ?? job.career_ops_score),
    priorityOverlay: bool(job.priorityOverlay ?? job.priority_overlay),
    jobUrl,
  };
}

export function normalizeContact(contact = {}) {
  return {
    ...contact,
    id: contact.id ?? contact.contactId ?? contact.contact_id,
    name: contact.name ?? contact.fullName ?? contact.contact_name ?? "Unknown Contact",
    company: contact.company ?? contact.contact_company ?? "",
    title: contact.title ?? contact.contact_title ?? "",
    linkedinUrl: contact.linkedinUrl ?? contact.linkedin_url ?? "",
    connectionStrength: numberOrNull(contact.connectionStrength ?? contact.connection_strength),
    vtAlumni: bool(contact.vtAlumni ?? contact.vt_alumni),
    recruiterSignal: bool(contact.recruiterSignal ?? contact.recruiter_signal),
    founderSignal: bool(contact.founderSignal ?? contact.founder_signal),
    roleRelevance: contact.roleRelevance ?? contact.role_relevance ?? "",
    notes: contact.notes ?? "",
  };
}

export function buildNetworkingShortlist({
  job,
  contacts = [],
  limitContacts = 5,
  minRankScore = 1,
} = {}) {
  const normalizedJob = normalizeNetworkingJob(job);
  const normalizedContacts = contacts.map(normalizeContact);
  return rankContactsForJob(normalizedJob, normalizedContacts)
    .filter((item) => item.rankScore >= minRankScore)
    .slice(0, limitContacts)
    .map((item) => ({
      ...item,
      job: normalizedJob,
      contact: normalizeContact(item.contact),
    }));
}

function normalizeTargetDetail(row = {}) {
  return {
    target: {
      id: row.id,
      status: row.status,
      rankScore: row.rank_score,
      rankingReason: row.ranking_reason,
    },
    job: normalizeNetworkingJob({
      id: row.job_id,
      company: row.job_company,
      role: row.job_role,
      tier: row.job_tier,
      score: row.career_ops_score,
      jobUrl: row.job_url,
      source: row.job_source,
    }),
    contact: normalizeContact({
      id: row.contact_id,
      name: row.contact_name,
      company: row.contact_company,
      title: row.contact_title,
      linkedinUrl: row.linkedin_url,
      email: row.contact_email,
      connectionStrength: row.connection_strength,
      vtAlumni: row.vt_alumni,
      recruiterSignal: row.recruiter_signal,
      founderSignal: row.founder_signal,
      roleRelevance: row.role_relevance,
      notes: row.contact_notes,
    }),
  };
}

function summarizeStoredTarget({ job, contact, item, target, draft, validation, researchNote, researchMissing = false }) {
  return {
    jobId: job.id,
    company: job.company,
    role: job.role,
    tier: job.tier,
    score: job.score,
    contactId: contact.id ?? null,
    contactName: contact.name,
    contactCompany: contact.company,
    contactTitle: contact.title,
    rankScore: item.rankScore,
    rankingReason: item.rankingReason,
    targetId: target?.id ?? null,
    targetStatus: target?.status ?? "not_stored",
    researchNoteId: researchNote?.id ?? null,
    researchStatus: researchNote?.status ?? null,
    researchMissing,
    draftId: draft?.id ?? null,
    draftStatus: draft?.status ?? null,
    draftValid: validation?.valid ?? null,
    manualOnly: true,
  };
}

export function buildNetworkingQueue({
  store = createStore(),
  jobs,
  contacts,
  limitJobs = 10,
  limitContacts = 5,
  minRankScore = 1,
  createDrafts = false,
  requireResearch = false,
  persist = true,
} = {}) {
  const candidateJobs = (jobs ?? store.listNetworkingEligibleJobs({ limit: limitJobs }))
    .slice(0, limitJobs)
    .map(normalizeNetworkingJob);
  const availableContacts = (contacts ?? store.listContacts()).map(normalizeContact);
  const warnings = [];
  const results = [];
  let storedTargets = 0;
  let storedDrafts = 0;

  if (candidateJobs.length === 0) {
    warnings.push("No T2/T3 or connection-priority Maxim jobs were found in the local store.");
  }
  if (availableContacts.length === 0) {
    warnings.push("No contacts were found. Import contacts before building a store-backed shortlist.");
  }

  for (const job of candidateJobs) {
    const shortlist = buildNetworkingShortlist({
      job,
      contacts: availableContacts,
      limitContacts,
      minRankScore,
    });
    if (shortlist.length === 0) {
      warnings.push(`No ranked contacts met the threshold for ${job.company} - ${job.role}.`);
    }

    for (const item of shortlist) {
      const contact = persist ? store.upsertContact(item.contact) : item.contact;
      const target = persist
        ? store.upsertNetworkingTarget({
            jobId: job.id,
            contactId: contact.id,
            rankScore: item.rankScore,
            rankingReason: item.rankingReason,
            status: createDrafts ? "ready_to_send" : "ready_to_research",
            preserveStatus: true,
          })
        : null;
      if (target) {
        storedTargets += 1;
      }

      let draft = null;
      let validation = null;
      let researchNote = null;
      let researchMissing = false;
      if (createDrafts) {
        researchNote = target?.id ? store.latestNetworkingResearchNote(target.id) : null;
        researchMissing = requireResearch && !researchNote?.research_text;
        if (researchMissing) {
          warnings.push(`Research note required before drafting for ${contact.name} -> ${job.company} - ${job.role}.`);
        } else {
          const builtDraft = buildNetworkingDraft({
            contact,
            job,
            research: researchNote?.research_text ?? "",
          });
          validation = validateMessageDraft(builtDraft.draftText);
          if (persist) {
            draft = store.upsertMessageDraft({
              targetId: target?.id ?? null,
              jobId: job.id,
              contactId: contact.id,
              ...builtDraft,
              validation,
              preserveStatus: true,
            });
            storedDrafts += 1;
          } else {
            draft = builtDraft;
          }
        }
      }

      results.push(summarizeStoredTarget({ job, contact, item, target, draft, validation, researchNote, researchMissing }));
    }
  }

  return {
    ok: true,
    source: jobs || contacts ? "provided" : "store",
    persist,
    createDrafts,
    requireResearch,
    jobsConsidered: candidateJobs.length,
    contactsConsidered: availableContacts.length,
    rankedTargets: results.length,
    storedTargets: persist ? storedTargets : 0,
    storedDrafts: persist && createDrafts ? storedDrafts : 0,
    warnings,
    shortlist: results,
    safety: {
      linkedinSending: "not_implemented",
      finalApplicationSubmission: "not_implemented",
      manualSendRequired: true,
    },
  };
}

export function recordNetworkingResearchNote({
  store = createStore(),
  targetId,
  researchText,
  source = "manual",
  status = "approved_for_draft",
} = {}) {
  if (!targetId) {
    throw new Error("targetId is required.");
  }
  if (!researchText || !researchText.trim()) {
    throw new Error("researchText is required.");
  }
  const detail = store.getNetworkingTargetDetail(targetId);
  if (!detail) {
    return {
      ok: false,
      message: "Networking target not found.",
      note: null,
    };
  }
  const note = store.upsertNetworkingResearchNote({
    targetId,
    jobId: detail.job_id,
    contactId: detail.contact_id,
    source,
    researchText: researchText.trim(),
    status,
  });
  return {
    ok: true,
    message: "Networking research note recorded.",
    note,
  };
}

export function buildMessageDraftForTarget({
  store = createStore(),
  targetId,
  researchText,
  requireResearch = false,
} = {}) {
  if (!targetId) {
    throw new Error("targetId is required.");
  }
  const detail = store.getNetworkingTargetDetail(targetId);
  if (!detail) {
    return {
      ok: false,
      message: "Networking target not found.",
    };
  }
  const { target, job, contact } = normalizeTargetDetail(detail);
  const researchNote = store.latestNetworkingResearchNote(targetId);
  const research = researchText?.trim() || researchNote?.research_text || "";
  if (requireResearch && !research) {
    return {
      ok: false,
      message: "Approved research note required before creating this draft.",
      targetId,
      researchRequired: true,
    };
  }
  const draft = buildNetworkingDraft({ contact, job, research });
  const validation = validateMessageDraft(draft.draftText);
  const storedDraft = store.upsertMessageDraft({
    targetId,
    jobId: job.id,
    contactId: contact.id,
    ...draft,
    validation,
    preserveStatus: true,
  });
  if (TARGET_STATUSES_SAFE_TO_PROMOTE.has(target.status)) {
    store.updateNetworkingTargetStatus(targetId, storedDraft.status ?? "ready_to_send");
  }
  return {
    ok: true,
    targetId,
    draft: {
      id: storedDraft.id,
      status: storedDraft.status,
      channel: storedDraft.channel,
      cta: storedDraft.cta,
      validation,
    },
    researchNoteId: researchNote?.id ?? null,
    draftText: storedDraft.draftText,
    manualOnly: true,
    safety: {
      linkedinSending: "not_implemented",
      manualSendRequired: true,
    },
  };
}

export function markMessageDraftStatus({ store = createStore(), draftId, status } = {}) {
  assertManualMessageStatus(status);
  const updated = store.updateMessageDraftStatus(draftId, status);
  return {
    ok: Boolean(updated),
    draft: updated,
    message: updated ? "Message draft status updated." : "Message draft not found.",
  };
}
