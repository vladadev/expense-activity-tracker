require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');

// Restores a backup produced by backup.js. DESTRUCTIVE: each collection in
// the backup replaces the live one entirely, so it is gated behind an
// interactive confirmation.
//
// Usage: npm run restore -- ./backups/2026-07-18_20-30-00

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function runRestore() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: npm run restore -- <backup-folder>');
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error(`Backup folder not found: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json');
  if (files.length === 0) {
    console.error('No collection files found in that folder.');
    process.exit(1);
  }

  console.log(`About to restore into database from: ${dir}`);
  for (const file of files) {
    const docs = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log(`  ${file.replace('.json', '')}: ${docs.length} documents`);
  }

  const answer = await ask('\nThis REPLACES those collections in the live database. Type "RESTORE" to continue: ');
  if (answer.trim() !== 'RESTORE') {
    console.log('Aborted — nothing was changed.');
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  for (const file of files) {
    const name = file.replace('.json', '');
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    // Re-hydrate the extended-JSON shapes that JSON.stringify flattened.
    const docs = raw.map((doc) => {
      const out = { ...doc };
      if (typeof out._id === 'string') out._id = new mongoose.Types.ObjectId(out._id);
      for (const [key, value] of Object.entries(out)) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)) out[key] = new Date(value);
        else if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) && key !== 'title' && key !== 'name') {
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
}

runRestore().catch((err) => {
  console.error('Restore FAILED:', err.message);
  process.exit(1);
});
