import { syncCareerOpsArtifacts } from "../lib/tracker-sync.mjs";

const result = syncCareerOpsArtifacts();
console.log(JSON.stringify(result, null, 2));
