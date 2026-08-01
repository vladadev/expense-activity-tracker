require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');

// Restores a backup produced by backup.js. DESTRUCTIVE: each collection in the
// backup replaces the live one entirely, so it is gated behind an interactive
// confirmation that names the exact database being overwritten.
//
// Accepts either form:
//   npm run restore -- ./backups/2026-08-01_18-48-57          (unpacked folder)
//   npm run restore -- ./backup-2026-08-01.tar.gz.gpg         (encrypted archive)
//
// Target database comes from MONGODB_URI, or --to=<uri> to aim somewhere else
// (e.g. seeding the dev database from a production backup).

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

function describeTarget(uri) {
  // Never print credentials — just enough to recognise the target.
  const withoutCreds = uri.replace(/\/\/[^@]+@/, '//');
  const host = withoutCreds.split('/')[2] || '?';
  const dbName = (withoutCreds.split('/')[3] || '').split('?')[0] || '(default)';
  return { host, dbName };
}

// Turns an encrypted archive into a directory of JSON files.
async function unpackArchive(archivePath) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
  const passphrase = process.env.BACKUP_PASSPHRASE || (await ask('Backup passphrase: '));
  if (!passphrase) throw new Error('A passphrase is required to open an encrypted archive');

  execFileSync('gpg', [
    '--batch', '--yes', '--quiet',
    '--decrypt',
    '--passphrase', passphrase,
    '--output', path.join(workDir, 'backup.tar.gz'),
    path.resolve(archivePath),
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // Bare filename + cwd: an absolute Windows path makes tar read "C:" as a host.
  execFileSync('tar', ['-xzf', 'backup.tar.gz'], { cwd: workDir });
  fs.rmSync(path.join(workDir, 'backup.tar.gz'), { force: true });

  // The dump sits either at the root or inside one timestamped folder.
  if (fs.existsSync(path.join(workDir, '_manifest.json'))) return { dir: workDir, temp: workDir };
  const nested = fs
    .readdirSync(workDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(workDir, e.name))
    .find((d) => fs.existsSync(path.join(d, '_manifest.json')));
  if (!nested) throw new Error('No _manifest.json inside the archive — not a valid backup');
  return { dir: nested, temp: workDir };
}

async function runRestore() {
  const args = process.argv.slice(2);
  const source = args.find((a) => !a.startsWith('--'));
  const toArg = args.find((a) => a.startsWith('--to='));
  const targetUri = toArg ? toArg.slice(5) : process.env.MONGODB_URI;

  if (!source) {
    console.error('Usage: npm run restore -- <backup-folder|archive.tar.gz.gpg> [--to=<mongodb-uri>]');
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`Not found: ${source}`);
    process.exit(1);
  }
  if (!targetUri) {
    console.error('No target database — set MONGODB_URI or pass --to=<uri>');
    process.exit(1);
  }

  let dir = source;
  let tempDir = null;
  if (fs.statSync(source).isFile()) {
    console.log('Encrypted archive detected — opening it...');
    const unpacked = await unpackArchive(source);
    dir = unpacked.dir;
    tempDir = unpacked.temp;
    console.log('Archive opened.\n');
  }

  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json');
    if (files.length === 0) throw new Error('No collection files found in that backup');

    const { host, dbName } = describeTarget(targetUri);
    console.log('About to restore:');
    for (const file of files) {
      const docs = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      console.log(`  ${file.replace('.json', '').padEnd(15)} ${String(docs.length).padStart(5)} documents`);
    }
    console.log(`\n  TARGET DATABASE: ${dbName}`);
    console.log(`  ON HOST:         ${host}`);
    console.log('\nThis DELETES those collections in the target and replaces them with the backup.');

    // Naming the database is the guard against restoring into the wrong place
    // — a plain "yes" is far too easy to give to the wrong prompt. Scripts can
    // pass --confirm=<dbname>, which still forces them to state the target.
    const confirmArg = args.find((a) => a.startsWith('--confirm='));
    const answer = confirmArg ? confirmArg.slice(10) : await ask(`\nType the database name (${dbName}) to proceed: `);
    if (answer.trim() !== dbName) {
      console.log('Name did not match — aborted, nothing was changed.');
      process.exit(0);
    }

    await mongoose.connect(targetUri);
    const db = mongoose.connection.db;

    for (const file of files) {
      const name = file.replace('.json', '');
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      // Re-hydrate the extended-JSON shapes that JSON.stringify flattened.
      const docs = raw.map((doc) => {
        const out = { ...doc };
        if (typeof out._id === 'string' && /^[a-f\d]{24}$/i.test(out._id)) {
          out._id = new mongoose.Types.ObjectId(out._id);
        }
        for (const [key, value] of Object.entries(out)) {
          if (key === '_id' || typeof value !== 'string') continue;
          if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)) out[key] = new Date(value);
          else if (/^[a-f\d]{24}$/i.test(value) && !['title', 'name', 'description', 'notes'].includes(key)) {
            out[key] = new mongoose.Types.ObjectId(value);
          }
        }
        return out;
      });

      await db.collection(name).deleteMany({});
      if (docs.length > 0) await db.collection(name).insertMany(docs);
      console.log(`Restored ${name}: ${docs.length} documents`);
    }

    console.log('\nRestore complete.');
    await mongoose.disconnect();
  } finally {
    // Decrypted personal data must not linger in temp.
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runRestore().catch((err) => {
  console.error('Restore FAILED:', err.message);
  process.exit(1);
});
