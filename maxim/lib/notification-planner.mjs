import crypto from "node:crypto";

function fingerprint(parts) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

export function planNotifications({ jobs = [], messageDrafts = [], recruiterThreads = [], now = new Date() } = {}) {
  const planned = [];
  for (const job of jobs) {
    const urgent = job.tier === "T3" || (job.tier === "T2" && `${job.flags ?? ""}`.includes("fresh"));
    if (urgent) {
      planned.push({
        fingerprint: fingerprint(["urgent_job", job.id ?? job.company, job.updated_at ?? ""]),
        notificationType: "urgent_fresh_t2_plus",
        channel: "discord",
        subject: `Urgent ${job.tier}: ${job.company ?? "Unknown"} - ${job.role ?? "Unknown role"}`,
        body: job.next_action ?? job.nextAction ?? "Review high-priority role.",
        immediate: true,
        status: "planned",
        scheduledFor: now.toISOString(),
      });
    }
  }
  const readyDrafts = messageDrafts.filter((draft) => draft.status === "ready_to_send");
  if (readyDrafts.length > 0) {
    planned.push({
      fingerprint: fingerprint(["draft_batch", String(readyDrafts.length), now.toISOString().slice(0, 10)]),
      notificationType: "message_draft_batch",
      channel: "discord",
      subject: `${readyDrafts.length} networking drafts ready`,
      body: "Review and send manually. No LinkedIn automation is used.",
      immediate: false,
      status: "planned",
      scheduledFor: now.toISOString(),
    });
  }
  const needsResponse = recruiterThreads.filter((thread) => thread.needsResponse || thread.needs_response);
  for (const thread of needsResponse) {
    planned.push({
      fingerprint: fingerprint(["recruiter_response", thread.id ?? thread.subject, thread.lastActivityAt ?? ""]),
      notificationType: "recruiter_needs_response",
      channel: "discord",
      subject: `Recruiter needs response: ${thread.subject}`,
      body: "Reply manually, then mark the thread responded.",
      immediate: true,
      status: "planned",
      scheduledFor: now.toISOString(),
    });
  }
  planned.push({
    fingerprint: fingerprint(["resume_variant_review", "21_day_saturday_placeholder"]),
    notificationType: "resume_variant_review",
    channel: "discord",
    subject: "3-week resume/PDF variant review",
    body: "Saturday reminder placeholder: review whether a resume/PDF variant should change based on outcomes.",
    immediate: false,
    status: "planned",
    scheduledFor: now.toISOString(),
  });
  return planned;
}

export function suppressDuplicateNotifications(planned = [], existingFingerprints = []) {
  const seen = new Set(existingFingerprints);
  return planned.filter((notification) => {
    if (seen.has(notification.fingerprint)) {
      return false;
    }
    seen.add(notification.fingerprint);
    return true;
  });
}
