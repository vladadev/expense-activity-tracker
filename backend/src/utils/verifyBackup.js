// Proves an encrypted backup is actually usable: decrypts it, unpacks it,
// validates the contents, and compares the record counts against the live
// database. An untested backup is only an assumption.
//
// Nothing is written to any database — this is read-only and safe to run
// against a production archive at any time.
//
// Usage: npm run verify:backup -- ./backup-2026-08-01.tar.gz.gpg
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');

const EXPECTED_COLLECTIONS = ['users', 'households', 'expenses', 'categories'];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => {
    rl.close();
    resolve(a);
  }));
}

async function verify() {
  const archive = process.argv[2];
  if (!archive) {
    console.error('Usage: npm run verify:backup -- <path-to-.tar.gz.gpg>');
    process.exit(1);
  }
  if (!fs.existsSync(archive)) {
    console.error(`File not found: ${archive}`);
    process.exit(1);
  }

  const passphrase = process.env.BACKUP_PASSPHRASE || (await ask('Backup passphrase: '));
  if (!passphrase) {
    console.error('A passphrase is required.');
    process.exit(1);
  }

  // Unpack into a throwaway temp directory, never into the project.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-verify-'));
  const tarPath = path.join(workDir, 'backup.tar.gz');

  try {
    console.log('\nDecrypting...');
    execFileSync('gpg', [
      '--batch', '--yes', '--quiet',
      '--decrypt',
      '--passphrase', passphrase,
      '--output', tarPath,
      path.resolve(archive),
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log('  Decryption OK — the passphrase is correct.');

    console.log('Unpacking...');
    // Run tar from inside workDir with a bare filename: an absolute Windows
    // path like C:\... makes tar read the drive letter as a remote host.
    execFileSync('tar', ['-xzf', 'backup.tar.gz'], { cwd: workDir });

    // Depending on how the archive was packed, the dump sits either at the
    // root or inside one timestamped folder — accept both.
    const dumpDir = fs.existsSync(path.join(workDir, '_manifest.json'))
      ? workDir
      : fs
          .readdirSync(workDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => path.join(workDir, e.name))
          .find((d) => fs.existsSync(path.join(d, '_manifest.json')));

    if (!dumpDir) throw new Error('No _manifest.json found — the archive is not a valid backup');

    const manifest = JSON.parse(fs.readFileSync(path.join(dumpDir, '_manifest.json'), 'utf8'));
    console.log(`  Backup taken: ${manifest.createdAt}`);
    console.log(`  Database:     ${manifest.database}`);

    let problems = 0;

    console.log('\nContents:');
    for (const [name, expectedCount] of Object.entries(manifest.collections)) {
      const file = path.join(dumpDir, `${name}.json`);
      if (!fs.existsSync(file)) {
        console.log(`  MISSING  ${name}`);
        problems++;
        continue;
      }
      // Parsing every file also proves none of them are truncated or corrupt.
      const docs = JSON.parse(fs.readFileSync(file, 'utf8'));
      const match = docs.length === expectedCount;
      if (!match) problems++;
      console.log(`  ${match ? 'ok  ' : 'BAD '} ${name.padEnd(15)} ${String(docs.length).padStart(5)} records`);
    }

    for (const required of EXPECTED_COLLECTIONS) {
      if (!manifest.collections[required]) {
        console.log(`  MISSING expected collection: ${required}`);
        problems++;
      }
    }

    // Spot-check that real content survived, not just the right shapes.
    const users = JSON.parse(fs.readFileSync(path.join(dumpDir, 'users.json'), 'utf8'));
    console.log(`\n  Accounts in backup: ${users.map((u) => u.name).join(', ')}`);
    const hasHashes = users.every((u) => typeof u.passwordHash === 'string' && u.passwordHash.length > 20);
    console.log(`  Password hashes intact: ${hasHashes ? 'yes' : 'NO'}`);
    if (!hasHashes) problems++;

    // Compare against the live database, if we can reach it.
    if (process.env.MONGODB_URI) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
        const live = mongoose.connection.db;
        console.log('\nCompared with the live database:');
        for (const [name, backupCount] of Object.entries(manifest.collections)) {
          const liveCount = await live.collection(name).countDocuments();
          const delta = liveCount - backupCount;
          const note = delta === 0 ? 'identical' : `${delta > 0 ? '+' : ''}${delta} since the backup`;
          console.log(`  ${name.padEnd(15)} backup ${String(backupCount).padStart(5)} | live ${String(liveCount).padStart(5)}  (${note})`);
        }
        await mongoose.disconnect();
      } catch (e) {
        console.log(`\n  (Could not reach the live database to compare: ${e.message})`);
      }
    }

    console.log(
      problems === 0
        ? '\nVERIFIED — this backup decrypts cleanly and its contents are complete.'
        : `\nPROBLEMS FOUND: ${problems}. Do not rely on this archive.`
    );
    process.exitCode = problems === 0 ? 0 : 1;
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    if (stderr.includes('Bad session key') || stderr.includes('decryption failed')) {
      console.error('\nDECRYPTION FAILED — wrong passphrase, or the file is corrupt.');
    } else {
      console.error('\nVerification failed:', err.message);
    }
    process.exitCode = 1;
  } finally {
    // The temp folder holds fully decrypted personal data — always remove it.
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

verify();
