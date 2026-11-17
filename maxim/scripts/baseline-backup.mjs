import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBaselineBackup, restoreBaselineBackup } from '../lib/baseline-backup.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2];
if (!command || ['--help', '-h'].includes(command)) {
  console.log('Usage: node maxim/scripts/baseline-backup.mjs create | restore <backup-id>');
} else {
  try {
    if (!process.env.LOCALAPPDATA) throw new Error('Protected Windows local storage is required');
    const privateRoot = path.join(process.env.LOCALAPPDATA, 'MaximApply', 'private');
    if (!fs.existsSync(privateRoot)) throw new Error('Provision and verify private directory ACL before backup');
    if (command === 'create') {
      const members = [];
      const walk = rel => {
        const p = path.join(repo, rel);
        if (!fs.existsSync(p)) return;
        const st = fs.lstatSync(p);
        if (st.isSymbolicLink()) throw new Error('Linked source refused');
        if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(rel, n));
        else if (st.isFile() && !/-(wal|shm)$/.test(p)) members.push(rel.split(path.sep).join('/'));
      };
      for (const p of ['cv.md', 'config/profile.yml', 'modes/_profile.md', 'article-digest.md', 'portals.yml',
        'data', 'reports', 'output', 'jds', 'interview-prep', 'writing-samples']) walk(p);
      const backupId = 'baseline-' + Date.now();
      const result = createBaselineBackup({ sourceRoot: repo, destination: path.join(privateRoot, 'backups', backupId), members });
      console.log(JSON.stringify({ backupId, ...result, credentialsExcluded: true }));
    } else if (command === 'restore') {
      const id = process.argv[3];
      if (!/^baseline-\d+$/.test(id || '')) throw new Error('Invalid backup ID');
      const recoveryRoot = path.join(privateRoot, 'recoveries');
      const result = restoreBaselineBackup({ backupRoot: path.join(privateRoot, 'backups', id),
        recoveryRoot, target: path.join(recoveryRoot, id + '-' + Date.now()), forbiddenRoots: [repo] });
      console.log(JSON.stringify(result));
    } else throw new Error('Unknown command');
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
