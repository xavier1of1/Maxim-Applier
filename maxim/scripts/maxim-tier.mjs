import { MaximPolicyEngine } from "../lib/policy-engine.mjs";
import { assignTier, routeEvaluation } from "../lib/tier-router.mjs";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const score = Number(arg("score") ?? process.argv[2]);
const evaluation = {
  score,
  company: arg("company"),
  role: arg("role"),
  locationText: arg("location"),
  salaryText: arg("salary"),
  postedAt: arg("posted-at"),
  description: arg("description"),
  connectionStrength: Number(arg("connection-strength") ?? 0),
};
const tier = assignTier(score);
const flags = new MaximPolicyEngine().evaluate(evaluation, { tier: tier.tier }).flags;
console.log(JSON.stringify(routeEvaluation(evaluation, flags), null, 2));
