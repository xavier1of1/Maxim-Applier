import { writeDashboardSnapshot } from "../lib/dashboard-snapshot.mjs";

const result = writeDashboardSnapshot();
console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath: result.outputPath,
      counts: {
        todayActions: result.snapshot.todayActions.length,
        highConvictionJobs: result.snapshot.highConvictionJobs.length,
        networkingQueue: result.snapshot.networkingQueue.length,
        recruiterInbox: result.snapshot.recruiterInbox.length,
      },
    },
    null,
    2,
  ),
);
