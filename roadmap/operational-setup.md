# Operational Setup And Inputs

**Updated:** 2026-11-17.
**Delivered workspace:** [Actual startup, model/private storage and recovery guide](../docs/maxim/workspace.md). Run `npm run maxim:workspace`; preferred URL http://127.0.0.1:3010/maxim. S1 is verified; later service accounts remain stage-gated.
**Purpose:** What Xavier needs to provide, choose, authorize or install. The local workspace, reviewed intake, answer memory, public-feed discovery and S5 evaluation/manual tracking now exist; browser/mail/delivery/networking adaptations remain separately gated. See [current application workflow](../docs/maxim/application-lifecycle.md).
**Legacy checklist:** [Earlier operational inputs](../docs/V2%20Redesign/maxim_apply_operational_inputs_needed.md). Historical COMPLETE labels there are not newly verified credentials.

## Current Implemented Configuration (Takes Precedence Over Proposed Rows Below)

Use [Start and use Maxim](../docs/maxim/setup.md) and
[current verification](reviews/mvp-completion-verification.md). S6-S10 are now
integrated but final acceptance is outstanding. Docker recovered on November 18;
review [storage results and headroom](../docs/maxim/storage-maintenance.md) before
the final combined tests and production restart. No account was connected
and no candidate/application authority was silently activated.

| Capability | Exact input and location | Action |
| --- | --- | --- |
| Local workspace | Windows/npm, pinned Node 24, Rust/MSVC, Docker Linux engine with free disk | Run root workspace install/build/start scripts; use printed loopback URL |
| CSV/XLSX/ZIP imports | Python 3 and user-authorized private exports | Networking import; review normalized mappings/raw fields |
| Model | OpenAI model ID/key through Settings -> Model connection | Server-held runtime settings; no new OPENAI_API_KEY env parser |
| Browser | agent-browser 0.43.0 dependency and its Chrome install | Follow browser guide; fresh dedicated sessions, separate private-field consent; permitted live form examples still needed |
| Gmail | Desktop OAuth client ID/optional secret in protected `<privateRoot>/gmail/client.json` | Follow Gmail guide; exact expected account, 1-5 thread IDs, read-only consent and retention; no send/calendar scope |
| Discord | Existing private webhook and channel ID entered in Discord workspace | Confirm destination, preview categories, explicitly enable and set schedules; legacy .env webhook is not auto-imported |
| Candidate/application ownership | Reviewed projection/reconciliation and explicit activation | Existing approval of resume facts is not cutover consent |
| Demo | Approved live/fixture claim and duration | Review proposed demo-script.md; finish two actual rehearsals |

Normal private root is `%LOCALAPPDATA%/MaximApply/private/workspace`. Secrets
remain outside Git; DB backups exclude runtime/Gmail/Discord credential files.
`MAXIM_RUNTIME_FILE` is the implemented server selector. `MAXIM_BROWSER_HEADED_TEST`
is fixture-only. Do not set test mode on a personal installation or invent env
names from the older proposal tables. No LinkedIn account/API, new Discord bot,
paid broad-search account or Meta glasses is required for this implemented pilot.

The remaining sections preserve planning history and input rationale; rows marked
Proposed are not instructions to add working environment variables.

## 1. Numbered Input Checklist

1. **Sanitized candidate sources and approval:** Current resume/CV, contact details, portfolio/GitHub links, supported experience/metrics, restrictions and sample novel answers. Keep private files local; do not paste secrets or employer-proprietary evidence into public docs.
2. **Model access:** S1 now uses the pinned Next/React/Astryx workspace and server-side OpenAI adapter. Provide your own compatible model ID and API key through Settings only when enabling chat; manual intake needs no key.
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
| Astryx | Pinned 0.7.16 workspace dependency, production/interaction proof | Maintain browser regressions |
| Tokenizer / agent-browser | Microsoft tokenizer is pinned and tested in S3; agent-browser is not a product executor | S6 browser acceptance remains |
| Dossier/Cracked/Hiring Panel/LinkedIn/Graphify | References reviewed | No source vendored or runtime integration installed |
| Reported web ports 3000/8000 | Legacy, not the running workspace | Use the launcher URL, normally 3010; no second stack |

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
| `MAXIM_RUNTIME_FILE` | Implemented optional server-only selector | Normal startup generates protected runtime.json with DB/root credentials; no DATABASE_URL or MAXIM_PRIVATE_DATA_ROOT env parser |
| Settings -> Model connection | Implemented, server-held OpenAI key/model | No MAXIM_MODEL_PROVIDER/MAXIM_MODEL_ID env parser; no frontend key exposure |
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
10. **Rehearse the chosen claim.** Use `npm run maxim:workspace` and the [operating guide](../docs/maxim/workspace.md). S1 proves saved manual records/chat, not application filling or live notifications. Only rehearse implemented stages.

For EGM use, follow [development workflow](development-workflow.md); its install is complete, but a formal review requires configuration confirmation.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 6. Dependency And Approval Handoffs

The [detailed stages](stages/README.md) now exist. Core path is S0 -> S1 -> S2 -> S3 -> S5 -> S6 -> S11; no search/Gmail/Discord account is required merely to evaluate a manually entered role. S4 follows S2's reviewed preferences and durable worker.

[Shared contracts](stages/contracts.md) now have a delivered S1 host web/loopback PostgreSQL binding. Durable extraction workers and the interactive application browser remain later-stage work, not active processes.

S1 pins actual versions in maxim/app/package.json and its lockfile. See its operating guide and acceptance evidence; later optional dependencies still require their own gates.

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
