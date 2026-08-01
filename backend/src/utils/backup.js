require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Full logical backup of every collection to timestamped JSON files.
//
// Why this exists: MongoDB Atlas' free (M0) tier has NO automated backups,
// and Render's filesystem is ephemeral — anything written on the server is
// lost on redeploy. So backups must be pulled to durable storage OUTSIDE
// both: run this from a machine whose disk survives (and ideally syncs to
// cloud storage, e.g. a OneDrive/Dropbox folder).
//
// Usage:  npm run backup            -> ./backups/<timestamp>/
//         npm run backup -- <dir>   -> <dir>/<timestamp>/
const KEEP_LAST = 30; // prune older backup folders beyond this many

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

function pruneOldBackups(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  const dirs = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const excess = dirs.slice(0, Math.max(0, dirs.length - KEEP_LAST));
  for (const dir of excess) {
    fs.rmSync(path.join(rootDir, dir), { recursive: true, force: true });
    console.log(`Pruned old backup: ${dir}`);
  }
}

async function runBackup() {
  const rootDir = process.argv[2] || path.join(__dirname, '..', '..', 'backups');
  const outDir = path.join(rootDir, timestamp());
  fs.mkdirSync(outDir, { recursive: true });

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const manifest = { createdAt: new Date().toISOString(), database: db.databaseName, collections: {} };
  let totalDocs = 0;

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    manifest.collections[name] = docs.length;
    totalDocs += docs.length;
    console.log(`${name}: ${docs.length} documents`);
  }

  fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  // Guard against the worst failure mode: a backup that "succeeds" while
  // containing nothing. Connecting to the wrong database, or to one that was
  // wiped, would otherwise produce a green run and an empty archive — and the
  // scheduled prune would eventually rotate the good backups away behind it.
  if (totalDocs === 0) {
    throw new Error('Backup produced 0 documents — refusing to treat this as a successful backup');
  }
  if (!manifest.collections.users || manifest.collections.users === 0) {
    throw new Error('Backup contains no user accounts — this does not look like the right database');
  }

  pruneOldBackups(rootDir);

  console.log(`\nBackup complete: ${totalDocs} documents -> ${outDir}`);
  await mongoose.disconnect();
}

runBackup().catch((err) => {
  console.error('Backup FAILED:', err.message);
  process.exit(1);
});
