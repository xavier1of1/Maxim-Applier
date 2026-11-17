# Development And EGM Workflow

**Updated:** 2026-11-16. Applies to new Maxim work without overriding explicit user instructions or native data/safety contracts.

## 1. Installation And Scope

Installed/enabled: **egm@egm 0.1.1**, the complete [Elephant/Goldfish plugin](https://github.com/google/elephant-goldfish-model), including seven skills, reviewer agents and standards.

Local verified cache: `C:\Users\xkuba\.codex\plugins\cache\egm\egm\0.1.1`. Do not commit this machine-specific cache or copy only SKILL.md files; supporting resources are required.

The IDE-bundled Codex CLI supported plugins; the older global executable did not. Installation used the supported binary with:

~~~powershell
codex plugin marketplace add google/elephant-goldfish-model
codex plugin add egm@egm
~~~

Here `codex` means that plugin-capable executable, not necessarily the first one on PATH. The global CLI was not upgraded. Start a fresh Codex turn/session so the installed skills can be discovered.

Verified: installation success, enabled listing, manifest version, seven skill files, agents and document-standard directories. Not performed: a formal independent EGM review or convergence loop. The manifest notes this is not an officially supported Google product.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 2. Planning And Review Discipline

Read the relevant installed SKILL.md and its Codex integration instructions before invoking a workflow. Use the workflow appropriate to the task: brainstorm/draft, review/review-loop, drift report or bootstrap. Do not bypass its context, configuration, section-approval or resolution gates.

For this project:
1. Load the latest explicit user decisions, relevant roadmap section, actual code contracts and a small source reading list.
2. Separate accepted direction, recommendation, assumption, unresolved choice, current behavior and measured evidence.
3. Draft the relevant high-level/stage document without silently upgrading recommendations to approvals.
4. Propose a bounded fresh-context review configuration and obtain the required confirmation.
5. Dispatch reviewers with no inherited conversation, their persona/standard files, target and approved reading list. Do not claim a same-context self-review is independent.
6. Collect severity-ranked findings, distinguish failed/not-run reviewers, and present fixes/contested findings for human resolution.
7. Apply approved fixes, re-resolve target line ranges and obey the skill's turn boundary before another round.
8. Record reviewed scope, reviewer completion, accepted risks, open findings and iteration state. Do not call one clean round converged; follow the installed workflow's actual rule.

No background self-approval, automatic expansion into implementation, or manufactured review report. If isolated reviewers or a required input are unavailable, say what did not run.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 3. Suggested First Review Configuration

This is a proposal to confirm, not a review already executed.

| Input | Proposed value |
| --- | --- |
| TargetFile | `roadmap/high-level-roadmap.md` |
| SemanticTarget | Full file, with focus on S0-S6 dependencies and thin proofs |
| Reviewers | `design_critic`, `structural`, `zoom_out` |
| Standards | `feature-spec-standard` for design/structure; `zoom-out-standard` for zoom-out |
| GoldfishContext | `roadmap/README.md`, `roadmap/MANIFESTO.md`, `roadmap/external-components-assessment.md`, current DATA_CONTRACT and relevant existing code |
| Excluded context | Raw candidate files, secrets, uploads, mail, contacts, browser sessions, full private conversation |
| Output | Sanitized findings and proposed resolutions under the roadmap's review records, after approval |

A detailed stage plan later benefits from implementation_readiness and codebase_details reviewers with exact files/commands. A high-level roadmap must not be rejected solely because detailed implementation choices are explicitly deferred to those stage plans.

The original commented workflow is a user source, not automatically a safe public reviewer fixture. Include only necessary reviewed excerpts and protect personal context.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 4. Implementation And Evidence

Detailed plans now live in [stages](stages/README.md). Run `node roadmap/validate-roadmap.mjs` and `node --test roadmap/validate-roadmap.test.mjs` after plan edits; these are available planning checks, not product acceptance.

The [drift report](reviews/2026-11-16_DRIFT_REPORT.md) uses the installed EGM same-context code/design workflow. It is not the formal fresh-context review described above; no convergence or human approval gate is simulated.

Before code changes, identify authority, patch boundary, user/system/artifact separation, migration ownership and a thin acceptance test. Keep native scoring/PDF/scanning behavior unless the approved stage requires a documented extension.

Use small scoped patches and structured parsers. Run relevant unit/integration/native/UI checks at each substantial boundary; record exact commands/date/environment. Preserve unrelated user edits and private data.

For canonical cutover, prove idempotent import, raw-field preservation, conflict review, status/artifact reconciliation, backup/restore and rollback before disabling a writer.

For browser/integration changes, test denied actions, unknown fields, retries, rate limits, credential revocation, privacy, manual final-action control and restart recovery. Static searches supplement, not replace, behavioral tests.

Do not install a library because it appears in the component list. Follow the [adoption protocol](external-components-assessment.md#13-research-evidence-and-adoption-protocol), pin source/license/notices and dependencies, and document a removal/fallback path.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 5. Optional Engineering Tools And Data Safety

Graphify is optional source-only analysis after an explicit allowlist/privacy review. No personal documents, .env, DBs, contacts, mail, sessions, private reports or backups by default. Inferred graph edges require code verification.

Hermes and other orchestration runtimes are not part of the chosen MVP. Astryx, token counting, agent-browser and adapted interview tools remain stage-gated candidates. No evasion/CAPTCHA plugins or LinkedIn send tooling.

Do not expose private candidate context to third-party research services, public issues, or unreviewed skill scripts. Provider/API keys and session secrets remain outside prompts, Git, tool output and demonstration fixtures.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 6. Miscellaneous Development Notes

Record process improvements here with a concrete pain point and an observable benefit. Preserve the distinction between installing a tool, using a method, and verifying a product capability.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.
