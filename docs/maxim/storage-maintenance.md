# Storage Maintenance

Updated: 2026-11-18. Canonical folder: `D:\VSC Programs\maxim-apply`.

## What Was Fixed

The application source is not a 79 GB directory. The checkout measured about
1.85 GB, mostly dependencies, a browser download and generated Rust/Next builds.
Docker's approximately 79 GB Windows disk is shared by several unrelated projects.
Its inventory showed 24.29 GB of images, 39.08 GB of volumes and 15.81 GB of build
cache. These categories are not a promise of Windows disk space reclaimable by
Maxim; image layers/cache can be shared and virtual disks retain allocated space.

Two real test-retention defects were corrected: older SQLite/history tests omitted
teardown, and the Discord database harness did not request anonymous-volume removal.
All three app database harnesses now use one owned-resource lifecycle: dedicated
names/labels, automatic removal, explicit volume cleanup, bounded container logs,
and independent ownership records outside per-fixture folders. Shutdown attempts
every cleanup step even when an earlier step fails. Failed setup runs cleanup too.

Fixture roots carry installation/owner/PID markers. Cleanup refuses active owners,
unverified markers, changed content, escaping paths, junctions and symbolic links.
Preview fingerprints include file hashes, not just sizes or timestamps. A reused
PID is conservatively kept rather than guessed dead. Docker cleanup checks current
labels again and never performs global container/image/volume pruning.

## Commands

From the repository root:

~~~powershell
npm run maxim:storage
npm run maxim:clean
npm run maxim:clean -- --apply --plan "REPLACE_WITH_PRINTED_PLAN_PATH"
npm run maxim:storage:test
~~~

`maxim:storage` is read-only and reports generated files, external browser storage,
disk headroom, owned leftovers and Docker availability/usage. Links are not followed
or double-counted. Docker checks have deadlines and can report unavailable.

`maxim:clean` (or `-- --dry-run`) writes a preview but deletes no resources.
`--apply --plan` revalidates the exact preview before action. Plans expire after
24 hours; successful plans are removed. Changed/active/unknown targets are kept
with a reason. Partially failed application exits unsuccessfully; inspect its
results and generate a new preview rather than blindly retrying stale state.
Independent Docker records allow recovery after the scratch folder is already gone.
Only anonymous volume IDs recorded for that exact owned test container are eligible;
Docker refuses removal if another container still references a volume.

The command intentionally does not auto-adopt historical unmarked directories,
unlabeled Docker volumes, personal backups, candidate sources or browser profiles.
Old orphaned volume creation dates alone do not establish ownership.

## Storage Locations And Bounds

- Scratch/compile caches: `D:\MaximApply-TestTemp` by Windows default. The supported
  `MAXIM_TEST_TEMP_ROOT` override must name an external `MaximApply-TestTemp` folder,
  outside the checkout. Test commands set TEMP/TMP/TMPDIR and compile-cache location
  for their child processes only, not the global Windows environment.
- Test databases require 2 GiB scratch-drive headroom and 10 GiB on the known
  Windows Docker virtual-disk drive. A different/custom Docker backend needs its
  own host-capacity monitoring; this is not a universal Docker storage quota.
- Test container logs: two 5 MB files maximum per fixture. Network/model/provider
  tests still use bounded loopback fixtures and never production credentials.
- Playwright binaries: `D:\MaximApply-Browsers\playwright`, opted in by the local
  `.maxim-browser-cache.json` marker. Test and workspace processes use the supported
  `PLAYWRIGHT_BROWSERS_PATH` setting. Old default locations retain junctions for
  native CLI compatibility. Only Maxim-required Chromium revisions were moved;
  the other project's browser and shared helpers remain on C:.
- Agent-browser's separate Chrome binary was already moved to ignored D: storage
  in the preceding work. It remains the application executor; Playwright remains
  PDF/test infrastructure. No browser engine was replaced for storage convenience.
- Live candidate sources, credentials and PostgreSQL ownership are unchanged.
  Backups remain private and are never cleanup candidates. Review backup retention
  deliberately; a new backup is expected storage, not a temporary test artifact.

## Executed Cleanup And Verification

- Relocated roughly **1.49 GB** of required browser binaries off C:, without
  deleting a version still needed by Maxim or another project. Both retained and
  app Playwright versions launched and rendered valid synthetic PDFs afterwards.
- Removed **146 verified legacy fixture directories / 27,054,069 bytes**. The
  one-time review checked exact Temp containment, fixture families, read-only
  SQLite integrity/schema/company signatures, bounded rows, file layouts and
  known fixture hashes. A second fingerprint pass preceded deletion. Two matching
  SQLite-family folders with unverified contents and other historical evidence
  were kept. This review is not a broad age/name-based automatic deletion policy.
- Recovered Docker through an explicitly approved Docker-only force restart.
  No unrelated WSL distribution was terminated and no disk reset ran.
- With separate explicit permission, cleared only unused shared build cache using
  `docker buildx prune --force --all`. Docker reported **21.25 GB reclaimed**;
  build cache is now zero. Image/container/volume counts stayed **37 / 23 / 197**.
  Shared cache/layer accounting explains why this differs from the earlier 15.81 GB
  cache summary. No container, application image or database volume was pruned.
  The Windows VHDX still measured 79,016,493,056 bytes afterwards; do not describe
  internal reclaimed capacity as an equal reduction of the Windows disk file.
- Fresh protected backup `workspace-1795025360962` passed isolated restore with
  168 jobs and three artifacts. Live counts remained 168 jobs, 37 current approved
  facts and zero workspace applications; candidate ownership remains legacy. Native
  trackers were not cleared or migrated. The temporary recovery copy was removed;
  the backup was retained and copied to ACL-protected `D:\MaximApply-Backups`.
- Three actual PostgreSQL fixture cycles each removed their container, anonymous
  volume and directory; global volume count stayed **197 -> 197**. A separate
  real interrupted-child case recovered its remaining container/volume through the
  persisted record after its scratch directory had already been removed.
- Thirteen storage safety tests pass, including an actual failed-test teardown,
  interrupted-process recovery, same-size content tampering, live owner, escaped
  path, symlink/junction, expired plan, partial shutdown, owned-browser shutdown
  failed-browser recovery and low-disk denial.
- Retained Maxim suite: 70 passed. App unit suite: 35 passed. Combined real S6/S8/S10
  integration: 33 passed. Production build/typecheck passed. A pre-existing S8
  test assumed optional producer views were absent; it now explicitly isolates
  that condition and restores the integrated views in finally.

No live Gmail, Discord, model or employer application action was performed.
Maxim's database was returned to its prior stopped state after backup verification.
Docker itself is running; other projects retain their original restart policies.

## Remaining Docker Work

Shared images and 170 unreferenced anonymous volumes were inventoried, not
indiscriminately deleted. Unused build cache alone was cleared with permission.
Many volumes were created during recent development,
but an unlabeled volume cannot safely be assigned to Maxim from its date alone.
The deprecated Maxim-Applier database volume was explicitly preserved as user data.

Moving Docker's complete disk to D: remains unperformed: opening Docker Desktop
through computer use timed out twice waiting for app approval. The optional Windows
Optimize-VHD tool is not installed; no unsupported disk edits/compaction were tried.
After reviewing other projects and approving UI access, use Docker Desktop's
Settings -> Resources -> Advanced -> disk image location to choose an empty D:
destination, Apply/Restart, then verify all prior volumes and the Maxim backup.
Do not replace an existing disk image or manually delete the C: VHDX.

Shared unused build cache is a separate opt-in cleanup because it affects future
build speed for other projects. Database volumes are never part of that operation.
Do not run heavy shared-cache maintenance concurrently with integration tests:
one final browser rerun passed its assertions but hit the bounded Docker teardown
deadline during pruning. Its independent record was retained and safely recovered
afterwards with the preview/apply commands above. The subsequent standalone browser
integration rerun passed all three TAP cases, including teardown. If browser
shutdown itself fails, the harness retains its fixture/session records for recovery
while still attempting server and database shutdown.
