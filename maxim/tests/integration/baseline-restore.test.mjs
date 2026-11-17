import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBaselineBackup, restoreBaselineBackup } from '../../lib/baseline-backup.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maxim-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'source'), recoveryRoot = path.join(root, 'recoveries');
  fs.mkdirSync(path.join(sourceRoot, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'candidate.json'), JSON.stringify({ id: 'candidate-fixture', raw: 'exact original', report: 'reports/job.md' }));
  fs.writeFileSync(path.join(sourceRoot, 'reports/job.md'), 'score: 4.6\nartifact: packet.pdf\n');
  fs.writeFileSync(path.join(sourceRoot, 'packet.pdf'), 'synthetic packet bytes');
  const backupRoot = path.join(root, 'backup');
  createBaselineBackup({ sourceRoot, destination: backupRoot, members: ['candidate.json', 'reports/job.md', 'packet.pdf'] });
  const run = target => restoreBaselineBackup({ backupRoot, recoveryRoot, target, forbiddenRoots: [sourceRoot] });
  return { root, sourceRoot, recoveryRoot, backupRoot, run, target: path.join(recoveryRoot, 'restored') };
}
test('restore preserves exact fields, identity, artifact links and bytes, repeatably', t => {
  const f = fixture(t);
  assert.equal(f.run(f.target).verified, true);
  assert.deepEqual(fs.readFileSync(path.join(f.target, 'candidate.json')), fs.readFileSync(path.join(f.sourceRoot, 'candidate.json')));
  const candidate = JSON.parse(fs.readFileSync(path.join(f.target, 'candidate.json')));
  assert.equal(candidate.id, 'candidate-fixture');
  assert(fs.existsSync(path.join(f.target, candidate.report)));
  assert.equal(f.run(path.join(f.recoveryRoot, 'second')).fileCount, 3);
  assert.throws(() => f.run(f.target), /must not exist/);
});
test('production, ancestor and recovery-root targets are refused', t => {
  const f = fixture(t);
  for (const target of [f.root, f.sourceRoot, f.recoveryRoot]) assert.throws(() => f.run(target));
  assert.equal(fs.readFileSync(path.join(f.sourceRoot, 'packet.pdf'), 'utf8'), 'synthetic packet bytes');
});
test('corrupt backup fails before creating the restore target', t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.backupRoot, 'files/packet.pdf'), 'corruption');
  assert.throws(() => f.run(f.target), /verification failed/);
  assert(!fs.existsSync(f.target));
});
test('missing artifact fails before creating the restore target', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.backupRoot, 'files/packet.pdf'));
  assert.throws(() => f.run(f.target));
  assert(!fs.existsSync(f.target));
});
test('manifest traversal and duplicate members are refused', t => {
  const f = fixture(t), p = path.join(f.backupRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(p));
  manifest.entries[0].name = '../outside';
  fs.writeFileSync(p, JSON.stringify(manifest));
  assert.throws(() => f.run(f.target), /Invalid backup member/);
  assert(!fs.existsSync(f.target));
});
test('backup cannot overwrite source or an existing destination', t => {
  const f = fixture(t);
  assert.throws(() => createBaselineBackup({ sourceRoot: f.sourceRoot, destination: f.sourceRoot, members: ['candidate.json'] }));
  assert.throws(() => createBaselineBackup({ sourceRoot: f.sourceRoot, destination: f.backupRoot, members: ['candidate.json'] }));
});
