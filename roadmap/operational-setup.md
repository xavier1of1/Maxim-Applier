# Operational Setup And Inputs

**Updated:** 2026-11-16.
**Purpose:** What Xavier needs to provide, choose, authorize or install for the revised target. This is not a claim the future stack or configuration parser exists.
**Legacy checklist:** [Earlier operational inputs](../docs/V2%20Redesign/maxim_apply_operational_inputs_needed.md). Historical COMPLETE labels there are not newly verified credentials.

## 1. Numbered Input Checklist

1. **Sanitized candidate sources and approval:** Current resume/CV, contact details, portfolio/GitHub links, supported experience/metrics, restrictions and sample novel answers. Keep private files local; do not paste secrets or employer-proprietary evidence into public docs.
2. **S1 stack/model choice:** Confirm the minimal web/backend/model approach and any existing frontend/API source location. Recommended TS/Node + React 19; one model adapter and shared tools. No new orchestration framework is required merely to use chat.
3. **Persistence and recovery location:** Choose protected host storage for PostgreSQL, uploads/artifacts, sessions and encrypted/protected backups, plus retention and restore destination. Compose/DB/artifact direction is already accepted.
4. **Dossier reuse choice:** Independent implementation of desired behavior is the recommended default. Copying/adapting its source needs an explicit AGPL-compatible plan or separately licensed permission.
5. **Discovery inputs:** Refine NoVA/DC companies, role lanes, queries, freshness/cadence and any explicit Maryland override. Choose an optional broad-search provider and budget only after coverage testing.
6. **Supported application examples:** Provide representative public Greenhouse/Lever links and permitted test scenarios; later company/Workday/LinkedIn/Indeed variants. A real application must stop at manual review; Xavier handles final submission.
7. **Existing Discord destination:** Confirm privately which maxim applier channel/webhook is intended, safe message contents, timezone, urgency and schedule. Do not create a duplicate server or post webhook/token values in chat.
8. **Gmail permission:** Choose the account and explicitly consent to the selected read-only product integration, message selection, model disclosure and retention. Connected assistant Gmail is not automatically the product adapter.
9. **Optional networking/practice material:** Authorized connection export/research, strength ratings, outreach style, project stories and interview targets. No LinkedIn login or OAuth is needed for manual export-based contacts.
10. **Demo script and scope:** Duration, visible surfaces, exact live claim, allowed synthetic/public data, and which integrations must actually work on November 19.

Only the items needed by a stage block it. Gmail, search-provider accounts, LinkedIn OAuth, remote browsers, Graphify, Hermes and wearables are not prerequisites to S1.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 2. What Already Exists Versus What Is Planned

| Item | Verified/known standing | Required action |
| --- | --- | --- |
| Career-Ops fork and Maxim modules | Present in canonical local maxim-apply repository | S0 checks exact running source, supported commands and baseline |
| Native SQLite/files/Go dashboard | Existing implementation, not the new PostgreSQL workspace | Preserve data; migrate only under approved stage gates |
| Discord named maxim applier | User-confirmed existing destination | Reuse; privately verify exact configured reference and permission |
| `MAXIM_DISCORD_WEBHOOK_URL` | Existing notifier environment key; prior record says configured | Do not expose value; prove correct acceptance/retry before relying on live scheduling |
| Model keys in `.env.example` | Gemini evaluator key exists in current config contract; OpenAI/Anthropic entries are comments/placeholders | Do not treat a commented key as a working shared runtime integration |
| EGM 0.1.1 | Installed/enabled complete Codex plugin | Fresh turn/session discovery; formal review config/human gates still needed |
| Astryx/Tokenizer/agent-browser | Researched candidates | No product dependency installed by this pass; adopt only through stage proof |
| Dossier/Cracked/Hiring Panel/LinkedIn/Graphify | References reviewed | No source vendored or runtime integration installed |
| Reported web ports 3000/8000 | Source not located in previous bounded fork inspection | Locate source or approve the single replacement workspace; no active URL promised here |

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 3. Accounts And Secrets Matrix

| Capability | Account or secret needed | When |
| --- | --- | --- |
| Local UI/DB/manual records | No external service account; local workspace access and protected DB credential | S1 |
| Model conversation/extraction/review | Chosen provider account/API key and explicit model budget | When selected model features are enabled; manual UI stays useful without it |
| Retained direct company feeds | Usually no candidate account for supported public feeds; provider/source rules still apply | S4; verify each method |
| JSearch broad search | OpenWebNinja or RapidAPI credential, depending on chosen host/plan | Optional S4 provider |
| Adzuna | App ID/key and supported country/attribution choice | Optional S4 alternative |
| FreeHire | No key required by the inspected public adapter; self-hosting has its own setup | Optional only after coverage/reliability review |
| Discord webhook | Existing private webhook reference for chosen channel | S8 live outbound delivery |
| Discord interactive bot | App/bot credential, guild/channel permission and explicit command scope | Only if interactive bot scope is separately selected |
| Gmail product read | Supported OAuth client/connection, consent and protected tokens | S7; exact registration/grant path chosen during detailing |
| LinkedIn connection import | User-authorized CSV/ZIP export, no developer API key | S9 |
| Optional own LinkedIn profile OAuth | Registered app/callback and secret; no social publishing scope by default | Only if a real need justifies it |
| Local browser assistance | Dedicated protected browser profile; user-controlled login/MFA when needed | S6 |
| Remote browser | Provider/session credentials and data-disclosure choice | Deferred separate mode |
| Astryx/Tokenizer/EGM content | No additional service account for local packages/plugin content | Model/runtime/network provisioning is separate |
| Graphify semantic analysis | Optional approved provider access; code AST analysis can be local | Development only if selected |
| Meta glasses | No product SDK/authorization path selected | Separate feasibility research, not MVP prerequisite |

Never send actual credentials to a recruiter, commit them, include them in screenshots, or store them as reusable answers. Register only the accounts needed for selected functionality; no broad batch sign-up is requested.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 4. Settings Contract: Existing Keys And Proposed Names

The future settings UI and configuration parser must be implemented and documented before these proposed names can be used. Adding them to .env today does not enable a feature.

| Name/reference | Standing | Purpose |
| --- | --- | --- |
| `MAXIM_DISCORD_WEBHOOK_URL` | Existing notifier key | Private outgoing webhook |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Existing native Gemini evaluator settings | Not proof of selected future agent runtime |
| `MAXIM_CANDIDATE_*` and existing answer overrides | Current legacy application-assist configuration | Import/reconcile with reviewed canonical facts; don't create permanent env-vs-DB ambiguity |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Commented examples in current env template, not implemented shared-runtime proof | Select provider first; use its actual documented integration |
| `DATABASE_URL` | Proposed S1 config name | PostgreSQL connection reference |
| `MAXIM_PRIVATE_DATA_ROOT` | Proposed S1 config name | Protected uploads/artifacts/session root, outside public source/build |
| `MAXIM_MODEL_PROVIDER` / `MAXIM_MODEL_ID` | Proposed runtime config names | Explicit provider/model selection |
| Search provider host/key/app reference | Proposed S4 settings, names unselected | Resolve credential shape from the selected provider; no invented working env command |
| Gmail client/connection/token reference | Proposed S7 settings, names unselected | Protected OAuth/token storage and account consent |
| Schedule/timezone/budget/retention settings | Proposed typed settings, names unselected | Persisted worker policy, not hidden process defaults |

The S1/S3 plan must resolve exactly which settings are secrets, user preferences, deployment config and legacy import inputs. Sensitive values must not be returned in settings API responses or chat.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 5. Step-By-Step Preparation

1. **Open the canonical repository.** Use `D:\VSC Programs\maxim-apply` on branch `maxim/v2-career-ops-fork`. The obsolete session folder maxim-applier is not the working source. Check `git status --short` before edits; don't delete untracked roadmap/user files.
2. **Review decisions, not every optional package.** Read [the index](README.md), [manifesto](MANIFESTO.md), [roadmap](high-level-roadmap.md), then [component assessment](external-components-assessment.md). Resolve S0/S1 blockers first.
3. **Prepare a private and a safe demonstration dataset.** Keep real resume/contact/answer data in protected local storage. Use explicitly synthetic or approved public files for tests/screen sharing, with no Wabtec proprietary content.
4. **Choose recovery locations.** Record where live DB/files/sessions and protected backups will live. Do not use public source directories or public cloud shares as the default. S0/S1 must test restore before production cutover.
5. **Confirm model access only after runtime choice.** Create/use a provider key through its official account interface, store it through the chosen local secret mechanism, and set a budget. Do not paste it into this document or assume the legacy Gemini wrapper is the new agent.
6. **Supply discovery preferences and optional provider choice.** Begin with known company feeds/manual job URLs. Compare broader providers on coverage, freshness, duplicates and cost before subscribing; no search account is needed just to add a role.
7. **Provide authorized browser test cases.** Start with public postings and isolated forms. Log in manually in a dedicated visible session when needed. Never provide passwords/MFA codes in chat or ask tooling to bypass a challenge.
8. **Confirm existing Discord privately.** Identify the intended channel/webhook reference and permitted contents. The eventual live test should follow a successful dry-run and HTTP-failure/retry test; existing manual delivery is not a scheduler.
9. **Connect Gmail only at its stage gate.** Review the real grant and retention/model disclosure, authorize the chosen account, test one known thread plus an ambiguous case, then test revocation. Read-only still needs careful consent.
10. **Rehearse the chosen claim.** Use the documented startup/recovery commands produced by the actual S1 implementation, prove same IDs across UI/agent, then rehearse only implemented stages. There is no new stack startup command in this planning revision.

For EGM use, follow [development workflow](development-workflow.md); its install is complete, but a formal review requires configuration confirmation.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 6. Dependency And Approval Handoffs

The [detailed stages](stages/README.md) now exist. Core path is S0 -> S1 -> S2 -> S3 -> S5 -> S6 -> S11; no search/Gmail/Discord account is required merely to evaluate a manually entered role. S4 follows S2's reviewed preferences and durable worker.

[Shared contracts](stages/contracts.md) propose host web/worker/interactive browser with PostgreSQL in loopback Compose for Windows. This is not an already launched stack, and no new startup URL is asserted by the plan.

S0/S1 will verify Node/package manager, React/framework, PostgreSQL/Compose, private storage and model adapter requirements. Pin versions in real implementation manifests, not speculative installation commands here.

S2 chooses safe PDF/DOCX/text parsers and extraction limits. S3 chooses a compatible tokenizer/counter and measured budget. S4 chooses providers. S6 chooses a browser package/browser binary and session protection. S7/S8 choose live credentials and schedules.

PostgreSQL does not replace private artifact storage, Compose does not create a backup, OAuth does not authorize sending, an export does not grant profile scraping, and a browser CLI does not provide universal ATS support.

Each handoff requires a runnable thin proof and denial/error cases. See the [stage contract](high-level-roadmap.md#18-verification-and-stage-detailing-contract). No candidate data or secrets need to be posted in chat for planning.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 7. Miscellaneous Inputs

Add additional accounts, approved data, permissions or dependencies discovered during implementation here. Record why they are needed, the stage, owner, safe storage reference and whether they are truly mandatory.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.
