import "dotenv/config";

import { planNotifications, suppressDuplicateNotifications } from "../lib/notification-planner.mjs";
import { createStore } from "../lib/sqlite-store.mjs";
import {readApplicationProjection} from '../lib/canonical-application-read.mjs';
if(readApplicationProjection()){
 console.error(JSON.stringify({ok:false,message:'Canonical notification delivery is an S8 acceptance gate. No stale SQLite notification was planned or sent.'}));
 process.exit(1);
}

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
  try{
   const response=await fetch(webhookUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'**'+notification.subject+'**\n'+notification.body})});
   await response.body?.cancel();
   if(!response.ok)throw Error('delivery_rejected');
  }catch{
   console.error(JSON.stringify({ok:false,dryRun:false,message:'Discord delivery failed; this fingerprint remains retryable. No automatic retry was sent.'}));
   process.exit(1);
  }
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
      "sent",
      notification.scheduledFor,
      JSON.stringify(notification),
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
}
console.log(JSON.stringify({ ok: true, dryRun: false, sent: planned.length }, null, 2));
