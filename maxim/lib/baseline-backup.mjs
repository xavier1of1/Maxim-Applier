import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inside = (root, p) => { const r = path.relative(root, p); return !path.isAbsolute(r) && r !== '..' && !r.startsWith('..' + path.sep); };
function canonical(p) {
  p = path.resolve(p);
  if (fs.existsSync(p)) return fs.realpathSync(p);
  return path.join(canonical(path.dirname(p)), path.basename(p));
}
function child(root, name) {
  if (typeof name !== 'string' || !name || path.isAbsolute(name) || name.includes('\\') ||
      name.split('/').some(s => !s || s === '.' || s === '..' || s.includes(':'))) throw new Error('Invalid backup member');
  const p = path.resolve(root, name);
  if (!inside(root, canonical(p))) throw new Error('Backup member escapes root');
  return p;
}
function separate(a, b) {
  if (inside(a, b) || inside(b, a)) throw new Error('Backup, source and recovery roots must be separate');
}
function regular(p) {
  if (!fs.lstatSync(p).isFile() || fs.lstatSync(p).isSymbolicLink()) throw new Error('Only regular files are supported');
}
export function createBaselineBackup({ sourceRoot, destination, members, maxBytes = 512 * 1024 * 1024 }) {
  sourceRoot = canonical(sourceRoot);
  destination = canonical(destination);
  separate(sourceRoot, destination);
  if (fs.existsSync(destination)) throw new Error('Backup destination must not exist');
  if (!Array.isArray(members) || members.length === 0) throw new Error('No files selected');
  const keys = new Set();
  let total = 0;
  const entries = members.map(name => {
    const key = name.toLowerCase();
    if (keys.has(key)) throw new Error('Duplicate backup member');
    keys.add(key);
    const source = child(sourceRoot, name); regular(source);
    total += fs.statSync(source).size;
    if (total > maxBytes) throw new Error('Backup exceeds size limit');
    return { name, sourceHash: hash(source) };
  });
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const entry of entries) {
    const source = child(sourceRoot, entry.name), target = child(destination, 'files/' + entry.name);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    if (/\.db$/i.test(entry.name)) {
      const code = 'import sqlite3,sys,pathlib\ns=sqlite3.connect(pathlib.Path(sys.argv[1]).as_uri()+"?mode=ro",uri=True)\nd=sqlite3.connect(sys.argv[2])\ns.backup(d)\nassert d.execute("PRAGMA integrity_check").fetchone()[0]=="ok"\nd.close()\ns.close()';
      const result = spawnSync('python', ['-c', code, source, target], { encoding: 'utf8', timeout: 30000 });
      if (result.status !== 0) throw new Error('SQLite snapshot failed');
      entry.kind = 'sqlite_snapshot';
    } else {
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      entry.kind = 'file';
    }
    entry.hash = hash(target);
    entry.bytes = fs.statSync(target).size;
  }
  for (const entry of entries) {
    if (hash(child(sourceRoot, entry.name)) !== entry.sourceHash) throw new Error('Source changed during backup; retry while quiescent');
    if (entry.kind === 'sqlite_snapshot' && fs.existsSync(child(sourceRoot, entry.name + '-wal'))) {
      throw new Error('WAL present: stop writers and checkpoint before coordinated backup');
    }
  }
  const manifest = { version: 1, sourceRoot, createdAt: new Date().toISOString(), entries };
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { fileCount: entries.length, bytes: entries.reduce((n, e) => n + e.bytes, 0) };
}
export function restoreBaselineBackup({ backupRoot, recoveryRoot, target, forbiddenRoots = [] }) {
  backupRoot = canonical(backupRoot); recoveryRoot = canonical(recoveryRoot); target = canonical(target);
  const manifest = JSON.parse(fs.readFileSync(path.join(backupRoot, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.entries) || !manifest.entries.length) throw new Error('Invalid manifest');
  if (target === recoveryRoot || !inside(recoveryRoot, target)) throw new Error('Target must be a new child of recovery root');
  for (const root of [backupRoot, canonical(manifest.sourceRoot), ...forbiddenRoots.map(canonical)]) separate(root, target);
  if (fs.existsSync(target)) throw new Error('Restore target must not exist');
  const keys = new Set();
  for (const entry of manifest.entries) {
    const key = String(entry.name).toLowerCase();
    if (keys.has(key)) throw new Error('Duplicate backup member');
    keys.add(key);
    child(target, entry.name);
    const source = child(backupRoot, 'files/' + entry.name); regular(source);
    if (hash(source) !== entry.hash || fs.statSync(source).size !== entry.bytes) throw new Error('Backup verification failed');
  }
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  for (const entry of manifest.entries) {
    const dest = child(target, entry.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    fs.copyFileSync(child(backupRoot, 'files/' + entry.name), dest, fs.constants.COPYFILE_EXCL);
    if (hash(dest) !== entry.hash) throw new Error('Restore verification failed');
  }
  return { fileCount: manifest.entries.length, verified: true };
}
