# External Components And Reuse Assessment

**Research date:** 2026-11-16.
**Standing:** Architecture recommendations, not implementation or performance claims.
**Scope:** The ten references Xavier supplied. Public primary documentation, selected source files and Dossier screenshots were inspected. No public project was run as a working Maxim integration.
**Only installation performed:** Complete EGM Codex plugin 0.1.1. All other product/tool dependencies remain uninstalled by this pass.

## 1. Executive Recommendation

Build a Dossier-inspired user journey using one shared Maxim/Career-Ops application contract. Prefer Astryx as the UI foundation if its compatibility spike succeeds. Keep Career-Ops scoring, PDF/report generation and useful direct provider scanning.

Add broader search behind a provider interface, not by transplanting another application. Add reusable facts/answers before a replacement browser executor. Evaluate agent-browser for that executor, with Maxim enforcing policy outside the CLI.

Use EGM for development review. Consider Graphify only for allowlisted source analysis. Adapt selected interview/resume-review ideas on explicit user request. Do not add Hermes or a second candidate profile/memory system without a concrete gap.

| User item | Recommended disposition | Proposed stage | Upstream license declaration |
| --- | --- | --- | --- |
| 1. Microsoft Tokenizer | Conditional model-compatible token counter | S1 instrumentation/S3 | MIT |
| 2. Astryx | Preferred single design-system candidate; spike first | S1 | MIT |
| 3. Cracked Skills | Adapt selected evidence-grounded practice workflows | S10 optional | MIT |
| 4. Dossier | Deep design/provider reference; code reuse license-gated | S1/S2/S4/S5/S7 | AGPL-3.0 |
| 5. Hiring Panel | Optional budgeted resume critique before approved packet | S5 | MIT |
| 6. LinkedIn connector | Export-based contacts useful; no broad LinkedIn automation | S9 | MIT |
| 7. Graphify | Optional source-only engineering analysis | S0/development | Apache-2.0 |
| 8. Hermes | Exclude from MVP; no specific project selected | Future only | Not assessed without a specific source |
| 9. Elephant/Goldfish | Installed complete Codex plugin; gated reviews | Throughout development | Apache-2.0 |
| 10. agent-browser | Preferred bounded executor candidate; spike first | S6 | Apache-2.0 |

These declarations are not a full dependency/license audit. Before vendoring/installing, pin a source/package version, inspect transitive licenses and executable hooks, retain notices, and record any local changes.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 2. Microsoft Tokenizer: Counting, Not Memory

**Sources:** [Repository](https://github.com/microsoft/Tokenizer), [TypeScript guide](https://github.com/microsoft/Tokenizer/blob/main/tokenizer_ts/README.md), [builder/model map](https://github.com/microsoft/Tokenizer/blob/main/tokenizer_ts/src/tokenizerBuilder.ts).

The TypeScript package `@microsoft/tiktokenizer` offers local BPE counting. It can help a context builder decide whether a request packet fits a budget. It does not select evidence, compress memory, guarantee recall, or make facts authoritative.

The inspected builder lists specific older model/encoding mappings, including GPT-4o and GPT-4 families. It does not establish support for every model we may select. Vocabulary files can be downloaded when absent; offline deployment needs a pinned/pre-cached path. The C# implementation is deprecated in favor of a separate Microsoft tokenizer library; there is no reason to add .NET here.

**Recommendation:** A replaceable counter adapter, only after selecting the actual provider/model. Unsupported models must return unsupported or a clearly labeled estimate, not silently use an unrelated encoding.

**Acceptance before adoption**
- Compare representative text/tool/schema/history payload counts with an authoritative supported counter or provider usage, accounting for framing differences and output reserve.
- Test multilingual text, long documents, tool output and oversize rejection.
- Pin vocabulary/package and prove offline operation after initial provisioning.
- Record actual provider usage separately from estimates. Never assert local string tokenization equals all billed request overhead.

**Setup/cost:** Local Node package/vocabulary, no tokenizer API key. Model calls still require the selected model account and budget.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 3. Astryx: Early Interface Foundation

**Sources:** [Repository](https://github.com/meta/astryx), [core setup/component guide](https://github.com/meta/astryx/blob/main/packages/core/README.md).

Astryx is a React 19+ design system with prebuilt CSS, themes, layout primitives, and a component/documentation CLI. Its components are authored with StyleX, but using prebuilt distributions does not require adding a StyleX compiler pipeline. Follow actual peer dependencies and CSS ordering rather than guessing from screenshots.

**Recommendation:** Preferred S1 candidate for the new single workspace, not an unconditional installed dependency. Use `@astryxdesign/core` and one appropriate theme if the spike passes. Use the scoped `@astryxdesign/cli`; its unscoped name can resolve to an unrelated package before local installation.

**Adopt:** Accessible navigation/layout, tables, forms, dialogs, status feedback and appropriate input primitives. Use a consistent compact operational design, meaningful icons/tooltips and responsive layouts.

**Do not adopt blindly:** Unpublished lab components, canary-only chart APIs, beta upgrades without review, or generated changes to AGENTS/CLAUDE instructions without inspecting the diff. Do not install a second Radix/shadcn base just to recreate Dossier on top of Astryx.

**Acceptance:** React/server-client compatibility, production build, theme/CSS order, keyboard/focus, upload review, table filtering, dialogs, chat integration, desktop/mobile text and layout checks. If the located existing frontend cannot use React 19 safely, choose one compatible foundation explicitly rather than forcing a broad upgrade.

**Setup/cost:** UI packages, theme and documented peers; no Astryx account/API key. Self-host fonts/assets when privacy/offline goals require it.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 4. Dossier: Deep Reuse Analysis

**Sources:** [Repository and product documentation](https://github.com/AienTech/dossier), [license](https://github.com/AienTech/dossier/blob/main/LICENSE). The jobs and dashboard screenshots were visually inspected; selected implementation files below were read.

### Why It Is A Strong Reference

Dossier solves many adjacent user-journey problems: an understandable persistent workspace, profile/import, jobs search, saved/dismissed history, applications, contextual document work, background progress, versions and inbox links.

The inspected search screen has persistent navigation, Search/Past searches/Saved/Dismissed tabs, explicit query/location controls, provider attribution and search time, list/detail inspection, and a direct start-application action. Those are useful workflow ideas. Maxim should retain a denser work-focused presentation rather than copying its typography, cream palette, rounded presentation or demo identity.

The application component composes posting/document/conversation/notes views, version/history state, ongoing jobs and explicit integration readiness. This is a better product reference than an isolated chat window plus unrelated tracker. It is not evidence that every upstream interaction is tested here.

### Licensing Gate Before Copying

Dossier's source is AGPL-3.0; this fork's current base is MIT. AGPL is not a permissive drop-in license. Its license contains conditions for distribution and modified network-interactive versions, including corresponding-source access. See the actual [license, including Section 13](https://github.com/AienTech/dossier/blob/main/LICENSE).

Recommended default: independently implement the desired behavior/contracts/UX using Maxim's own domain model. Do not paste or closely adapt AGPL components while claiming they remain solely MIT.

Alternative: Xavier explicitly chooses a compatible source-reuse/licensing plan, with attribution, notices, source obligations, dependency review and public/private deployment consequences understood, or obtains separately licensed permission. A network boundary or public repository is not automatic permission to ignore these issues. This is an engineering gate, not a legal determination that every possible architecture has identical obligations.

No Dossier source was copied and no repository relicensing occurred in this pass.

### Component-By-Component Disposition

| Inspected area | Useful concept | Maxim action | Conflict/gate |
| --- | --- | --- | --- |
| `src/app/(app)/jobs/jobs-screen.tsx` | Search history, saved/dismissed state, list/detail, actionable errors | Recreate workflow on shared job IDs in S1/S4 | Source reuse AGPL-gated; do not inherit styling stack |
| `src/lib/job-search/adapter.ts` | Narrow search/details/test interface | Independent normalized provider adapter | Contract must include source coverage/error semantics |
| `src/lib/job-search/search.ts` | Normalized result schema and persistent state | Source aliases, stable opening IDs, nullable facts, history | Preserve Career-Ops score; distinguish source from destination |
| `src/lib/job-search/jsearch.ts` | Configurable hosts/keys, pagination, parsing, direct links | Candidate S4 provider behind our interface | Paid/quota/terms setup; aggregator lag and incomplete data |
| `src/lib/job-search/freehire.ts` | Public/self-hosted catalog adapter | Optional source to evaluate | Location/radius limitations, availability/completeness unknown |
| `src/lib/job-search/http.ts` | Timeout/abort/response bounds and typed failures | Match reliability requirements | Not proof that every arbitrary outbound URL is safe |
| `src/lib/job-search/sources.ts` | Explain source setup, coverage and attribution | Provider settings/status UI | Exclude unofficial terms-conflicting source branches |
| `src/lib/agent/search.ts` | Saved-search request structure | Persist query intent/defaults | Do not inherit unrelated runtime/model workflow |
| `src/app/(app)/profile/import/profile-import.tsx` | Upload -> processing -> preview -> apply import | S2 review flow with per-field confirmation | Upstream merge can let imported values win; use explicit conflict review |
| `src/app/(app)/applications/[id]/application-view.tsx` | Contextual work, document versions, job progress, tabs | One application detail experience in S1/S5/S7 | Keep native PDF/scoring, one lifecycle; source copy license-gated |
| `src/lib/ai/fact-guard.ts` | Motivation to prevent unsupported rewrites | Use stronger source-linked claim checks | Do not adopt heuristic as candidate-truth proof |
| README inbox/calendar/MCP capabilities | Integration patterns and scope visibility | Consider only selected Gmail reads/tools | Not permission to copy send/calendar scopes or expose broad tools |

Other upstream files were not comprehensively audited. A component imported by a read file is not automatically a verified reusable component.

### What Its Search Actually Provides

Dossier does not provide first-party access to every job platform. It normalizes selected providers into a useful product workflow.

| Provider | Observed capability | Setup and limitation |
| --- | --- | --- |
| JSearch | Aggregated postings, including LinkedIn/Indeed-origin results, search/details/cursor workflow | OpenWebNinja or RapidAPI credentials depending on configured host; validate current plan/quota/terms |
| Adzuna | Alternative job-search provider described in source catalog | App ID/key, country support, attribution and possibly abbreviated descriptions |
| FreeHire | Public/self-hosted endpoint/catalog in inspected adapter | No provider key required by that adapter; coverage/availability not proved; radius not equivalent to location text |
| Bundesagentur-related unofficial source | Catalog includes an unofficial path with terms concerns | Exclude from Maxim; not needed for NoVA/DC |

A search result's platform/source label is not permission to automate that platform. Preserve provider attribution and the actual employer/application URL. A job search index can lag a direct employer feed.

Dossier's inspected defaults include bounded daily first-page search allowances and a single-process agent workflow. Do not copy those caps or scheduling assumptions into a fresh-high-fit alert requirement. Define a budget/cadence, persistent run/outbox state, partial pagination, backoff, last successful checks and quota errors.

**Recommended broad-search experiment:** Run equivalent user-approved NoVA/DC queries through one candidate provider and retained company feeds, measure relevant unique openings, latency/freshness, location accuracy, duplicate aliases, cost and failure handling. Choose a provider after this evidence, not because a demo contains many results.

### What Not To Bring Over

- Whole application/backend/Prisma schema as another parallel system.
- Alternative matching/ATS/resume diagnostics as Maxim's fit score.
- Another PDF generator replacing Career-Ops merely for visual similarity.
- Default model permissions, Gmail send/calendar scope, or social publishing.
- Unreviewed profile-import overwrite rules.
- Stand-in AI responses or sample candidate data as live fallback.
- Word/number matching as proof of truth. The inspected fact guard pools candidate and job-posting terms; a requirement appearing in a posting cannot authorize a candidate claim.
- A single-process in-memory schedule in place of durable local work.
- Provider terms violations, hidden scraping, or assumptions that API subscription grants browser privileges.

### Implementation Outcome

Dossier most strongly changes **how Maxim should feel and organize work**, plus the **contract for optional broad search**. It should not change who owns candidate truth or replace the Career-Ops engine.

Ship the workflow in increments: S1 workspace, S2 reviewed import, S4 provider-backed discovery, S5 contextual packet/lifecycle, S7 mail evidence. Each increment must work through both UI and agent with the same canonical IDs.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 5. Cracked Skills: Selective Interview Preparation

**Sources:** [Site](https://cracked-skills.vercel.app/), [linked source repository](https://github.com/nishant-Tiwari24/cracked), [skills](https://github.com/nishant-Tiwari24/cracked/tree/main/skills).

The inspected pack describes profile/journal-driven practice, project defense, behavioral/HR, system-design, coding and company preparation. It is useful content/interaction design, not an interview-success guarantee or a verified source of current employer questions.

**Recommendation:** Adapt project defense, behavioral/STAR, role-relevant system-design and company prep into optional S10. Ground responses in approved candidate facts, portfolio evidence, the actual posting, and retained Career-Ops story-bank/interview prep.

**Integration requirements**
- Replace the pack's separate local profile/journal authority with canonical services and private artifacts.
- Preserve appropriate prompt/skill attribution and related dependencies; don't cherry-pick a broken instruction with missing references.
- Label community company intel as uncertain practice material.
- Keep practice hypotheses and critique separate from approved resume/application claims.
- Sandbox explicit candidate-code execution, bound resources/network access, and exclude live-assessment cheating.

Do not introduce an ATS/JD diagnostic score as the Career-Ops fit source. Country-specific compensation advice in a general skill pack is not Xavier's NoVA/DC salary policy.

**Setup/cost:** No new account for the instruction content; model/runtime costs and any code execution are separately consented. No full pack was installed into Codex or the product here.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 6. Hiring Panel: Optional Resume Quality Review

**Sources:** [Repository](https://github.com/alexyc9381/hiring-panel-skill), [actual skill](https://github.com/alexyc9381/hiring-panel-skill/blob/main/skills/hiring-panel/SKILL.md).

The skill describes seven reviewer perspectives followed by an ATS recheck after revision, yielding eight subagent passes in its full workflow. That is meaningful cost/latency, not a free prerequisite to every application.

**Recommendation:** Optional S5 user-triggered critique before approving a final packet. Offer a cheaper focused review first; full panel for an explicitly selected role/variant after budget confirmation. Cache by source resume, approved facts, job and prompt/model revision.

Show findings and proposed diffs. The user approves changes; the retained Career-Ops generator produces the final PDF. Diagnostic feedback is not a new job-fit score or a prediction of actual hiring outcomes.

Never turn `[ADD]` prompts into invented metrics, never overwrite confirmed facts, and never infer active clearance. Store private review artifacts outside tracked source; the upstream `.hiring-panel/` output convention is not automatically private in this repository.

**Acceptance:** Supported-claim enforcement, placeholder rejection, approved diff and exact PDF linkage, cancellation/cost limits, private artifacts, and no automatic submission.

**Setup/cost:** Model/subagent capability and optional full-panel budget; no recruiter or ATS account. Not installed by this pass.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 7. LinkedIn Connector: Narrower Than The Name

**Source:** [Repository and documented tool/scopes](https://github.com/adamw7/claude-linkedin-connector).

The documented connector supports the authorized user's own OIDC profile/email, exported connections supplied as ZIP/Connections.csv, and social publishing operations. It does not establish job search, applications/Easy Apply, inbox/DM reading, live connection APIs, or arbitrary live people-profile research.

Its documented default scopes include `w_member_social` and its tool surface includes write actions. That is unnecessary authority for Maxim's networking shortlist. No automatic message sending is part of Maxim.

**Recommendation:** Prefer the existing Maxim CSV/contact import plus an independently implemented authorized export parser if needed. Reuse connector code only after source/dependency review and a read-only tool allowlist, not by exposing its whole MCP surface.

Connection exports do not require creating a LinkedIn developer app. Own-profile OAuth is optional future convenience and needs a registered app, callback and secret only if selected. Do not imply publishing permission grants recruiting/partner API access.

**Acceptance:** Idempotent export import, field mapping/provenance/privacy, strength 1-3 and research compatibility, no write/publish/message tools, and honest unsupported-feature labels.

**Setup/cost:** User-authorized export for initial contact work; no LinkedIn account automation or OAuth setup required for the existing no-login workflow. The upstream runtime documentation calls for Node 24+; assess compatibility only if adopting that code.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 8. Graphify: Development Analysis, Not Candidate Truth

**Source:** [Repository, default v8 branch](https://github.com/Graphify-Labs/graphify).

The project builds code/document graphs with distinguishable extracted and inferred relationships. Its documented Python package is `graphifyy`, not the similarly named package without the second y; CLI is `graphify`. Code/AST extraction can be local; semantic document/media analysis may invoke model/provider processing.

**Recommendation:** Optional S0/development architecture aid on an explicit source-code allowlist. It may help map imports and retirement boundaries, but an inferred graph edge is not proof of code behavior or a candidate fact.

Exclude .env, candidate/profile files, uploads/imports, reports/PDFs, contacts/mail, DBs, sessions/cookies, private traces and backups by default. Store any private analysis output outside public source/build contexts. Do not enable broad global hooks or agent read-blocking behavior without review.

No runtime graph service is proposed for the MVP. Revisit only if measured retrieval/dependency questions cannot be answered cheaply through code search/structured records and the privacy/correction tests pass. Upstream marketing about token savings is not a Maxim benchmark.

**Setup/cost:** Optional Python 3.11+ environment and reviewed package pin; model access only for explicitly approved semantic processing. Not installed.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 9. Hermes: No Current Reason To Add A Second Orchestrator

No exact Hermes repository/runtime was supplied. The user's preference is explicitly hesitant.

**Recommendation:** Exclude from MVP and do not infer a particular vendor, dependency or license. A shared agent/tool service already has a defined job. Another orchestration stack would increase session, secrets, tool-permission and operational complexity without a demonstrated gap.

Revisit only with a specific source, one unmet requirement, comparison to the existing runtime, migration cost, safety tests and explicit user choice. No install or account setup is needed now.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 10. Elephant/Goldfish: Installed Development Workflow

**Sources:** [Repository](https://github.com/google/elephant-goldfish-model), [Codex integration](https://github.com/google/elephant-goldfish-model/blob/main/docs/codex.md), [review loop](https://github.com/google/elephant-goldfish-model/blob/main/skills/egm-review-loop/SKILL.md).

Installed/enabled plugin: **egm@egm, 0.1.1**, complete skills/agents/resources. It is not a loose skill-only copy. The installed manifest describes it as not an officially supported Google product.

The older global Codex executable lacked plugin support. The IDE-bundled Codex executable successfully registered the marketplace and installed the plugin; plugin listing and local manifest/skill directories were verified. This did not upgrade the global CLI.

Use the installed skills after a fresh Codex turn/session loads them. The [development workflow](development-workflow.md) records installation verification and use.

**Use:** Deliberate planning context, explicit assumptions, fresh-context design/implementation reviews, severity-ranked findings and human resolution. Preserve its required configuration/approval gates; do not silently run an open-ended loop or autoaccept architecture changes.

**Not use:** Production candidate memory, an agent backend, a test runner substitute, or a claim that a document is reviewed merely because the plugin exists.

This pass applies explicit evidence/assumption boundaries and documents the future review process. No formal fresh-context EGM review or convergence is claimed. Configure and confirm that review separately.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 11. agent-browser: Candidate Browser Execution Layer

**Sources:** [Repository](https://github.com/vercel-labs/agent-browser), [security documentation](https://agent-browser.dev/security), [session documentation](https://agent-browser.dev/sessions).

The current documented tool is a native CLI/daemon with compact accessibility snapshots/references, persistent sessions, headed operation and browser/CDP control. It can be a useful low-level executor, not a complete application product.

**Recommendation:** Preferred S6 spike candidate. Pin a version and compare against a minimal direct browser adapter on Maxim's actual control/session/recovery requirements. Do not reinstate the old runner under a new name.

Required wrapper behavior:
- Allowlisted origins/actions with explicit candidate/application/session scope and protected dedicated profiles.
- Fresh observations after navigation/DOM changes; bounded steps/time/retries; clear unknown-field stops.
- Canonical answer lookup and approval, exact approved attachment identity, and meaningful review checklist.
- No final submit action available to the agent, including keyboard/form/network variants.
- User-controlled login/MFA/challenges, protected secrets/session state, local binding for debugging endpoints and no shared ordinary-browser attachment by default.
- No arbitrary evaluation/scripts or permission escalation from page instructions.

The upstream security ecosystem documents optional stealth/CAPTCHA integrations. **Explicitly exclude those plugins/providers and all evasion/bypass behavior.** Only the reviewed core action subset is a candidate. Optional allowlists/policies/security settings must actually be configured and tested; they are not automatic safety by installation.

Persistent browser state can be sensitive and may be plaintext without explicit protection. Session isolation differs between dedicated browser instances and tabs on a shared CDP browser. Test headed handoff/relaunch, pause/resume, and secret custody on Windows, not just a single click.

**Acceptance:** Representative Greenhouse/Lever controls, cross-frame file upload, multistep flow, stale refs, disconnect/restart, unknown/sensitive answers, permitted navigation, adversarial page content, final-action denial, and absence of evasion tools. Browser launch success alone is not enough.

**Setup/cost:** Reviewed native package/browser provisioning and protected storage; cloud browser is not required for the local pilot. Remote sessions would need a separate provider/security decision. Not installed.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 12. Cross-Component Compatibility And Missing Requirements

The [detailed plans](stages/README.md) now bind these recommendations to explicit producers/consumers and failure tests. S2 creates consumed durable work; S4 and integrations reuse it. Optional provider/tool adoption does not block manual job intake or the core assisted-application path. No additional dependency was installed by the refinement.

| Gap or collision | Resolution |
| --- | --- |
| Dossier whole app vs Career-Ops fork | Reuse concepts/contracts selectively; keep engine and one domain authority |
| Astryx vs Dossier UI primitives | One base component system, implement task layouts independently |
| New model vs Microsoft's explicit old model map | Validate exact counter/provider framing; no silent guessed encoding |
| Browser executor vs truthful knowledge | Shared answer/evidence service, not browser-owned memory |
| Skill profile/journals vs canonical candidate DB | Adapter-backed canonical reads/writes and private practice artifacts |
| Hiring Panel/ATS score vs Career-Ops tiering | Critique only; fit score remains Career-Ops |
| LinkedIn export/publishing vs desired job-site support | Separate contact import, job discovery, form assistance and social permissions |
| In-process search schedule vs Discord freshness | Durable scheduled runs/outbox, provider budgets and visible stale coverage |
| Dossier term-based fact guard vs claim accuracy | Candidate evidence authority distinct from employer text |
| Graphify inferred edges vs approved facts | Development aid only; no automatic fact promotion |
| EGM review vs validation | Formal human-gated fresh review plus actual build/test evidence |
| Existing Discord label vs deployable integration | Confirm private destination reference/runtime; don't recreate or invent credentials |

Required infrastructure not supplied by these libraries: local authentication/session scope, schema migrations, private artifacts and backup/restore, durable work, authorization, confirmations, audit/retention, provider key management, cost limits, and real UI/browser integration tests.

No combination of listed tools supplies universal legal/platform permission, complete discovery, automatic factual correctness, or reliable final-action control without project-specific design and testing.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 13. Research Evidence And Adoption Protocol

Selected file snapshots below are GitHub **blob SHAs**, not repository commit pins or deployed versions. Record an actual dependency/commit pin when adoption occurs.

| Source | Inspected blob SHA |
| --- | --- |
| Microsoft `tokenizer_ts/src/tokenizerBuilder.ts` | `b2a218814dae3b2b41bb2b286cd81c5b347f6771` |
| Astryx `packages/core/README.md` | `c4c656d48e41462bb7064654c2ac03a3a17ab9bb` |
| Dossier `README.md` | `ed6e6775eff755111cdd3689cb53ea87e8dd9180` |
| Dossier `LICENSE` | `be3f7b28e564e7dd05eaf59d64adba1a4065ac0e` |
| Dossier `src/lib/job-search/adapter.ts` | `cfd401cec9620b0f3413f90e542a9cfcb9cb2515` |
| Dossier `src/lib/job-search/jsearch.ts` | `d4c4a877c6782b523e45cc4cf2424e8613938dea` |
| Dossier `src/lib/job-search/freehire.ts` | `3ba17055b2aabde7ba2d952bf4b2aacfb763fd53` |
| Dossier `application-view.tsx` at path listed above | `41463c2eaca0d7fc8afa7332df5ac18c81265426` |
| Hiring Panel `skills/hiring-panel/SKILL.md` | `b8642f808ff7ed7af9db64a33530925ea5fb8ac4` |
| LinkedIn connector `README.md` | `acedce2e300b85f6bd70a430e9fe9d723fde5b15` |
| Graphify `README.md` | `ad5fd3cd72881f93691b4f4ea29a7c3897929c4d` |
| agent-browser `README.md` | `53f71fd42a568994479edfa5063c58ca0b5dad8d` |

Research limitations: no benchmarks, transitive dependency audit, product-run validation, provider subscription verification, live platform permission review, browser-site certification or wearable SDK test was performed. EGM installation/manifest verification is the only completed installation claim.

Before adoption:
1. Name the user outcome and stage; compare to a smaller native implementation.
2. Pin a source/package, license/notices and dependencies; review execution hooks/tool authority.
3. Define data/model/network disclosures and least privilege.
4. Run one vertical success proof and explicit denied/error/recovery tests.
5. Record operational cost, required setup, rollback/removal and a non-adoption fallback.
6. Update status only for the proved scope. Optional tools may remain deferred.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 14. Miscellaneous And Follow-Up Ideas

Add candidate components here with source, concrete benefit, license, risks, stage and a disconfirming test. A library list is not a dependency commitment.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.
