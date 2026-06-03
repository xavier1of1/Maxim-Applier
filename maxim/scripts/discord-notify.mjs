import "dotenv/config";

import { planNotifications, suppressDuplicateNotifications } from "../lib/notification-planner.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const dryRun = process.argv.includes("--dry-run") || !process.env.MAXIM_DISCORD_WEBHOOK_URL;
const store = createStore();
const existing = store.listNotificationFingerprints();
const planned = suppressDuplicateNotifications(
  planNotifications({
    jobs: store.listHighConviction(),
    messageDrafts: store.listReadyMessageDrafts(),
    recruiterThreads: store.listRecruiterNeedsResponse(),
  }),
  existing,
);

if (dryRun) {
  console.log(JSON.stringify({ ok: true, dryRun: true, planned }, null, 2));
  process.exit(0);
}

const webhookUrl = process.env.MAXIM_DISCORD_WEBHOOK_URL;
for (const notification of planned) {
  store.execute(
    `INSERT OR IGNORE INTO notifications
     (id, fingerprint, notification_type, channel, subject, body, immediate, status,
      scheduled_for, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `notification_${notification.fingerprint}`,
      notification.fingerprint,
      notification.notificationType,
      notification.channel,
      notification.subject,
      notification.body,
      notification.immediate ? 1 : 0,
      "planned",
      notification.scheduledFor,
      JSON.stringify(notification),
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `**${notification.subject}**\n${notification.body}` }),
  });
}
console.log(JSON.stringify({ ok: true, dryRun: false, sent: planned.length }, null, 2));
