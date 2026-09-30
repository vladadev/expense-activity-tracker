// Turns the old single `user.household` field into membership records.
//
// Safe to run more than once: it skips anyone who already has a live
// membership for that household. It does not clear `user.household` — that
// field stays exactly as it is, so this can be run while the old code is still
// deployed, and rolling back changes nothing.
//
//   npm run migrate:memberships           (development database)
//   npm run migrate:memberships -- --prod (production, asks first)

require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const { resolveUri } = require('../config/db');
const User = require('../models/User');
const Membership = require('../models/Membership');

async function migrate() {
  const users = await User.find({ household: { $ne: null } }).select('name household createdAt');
  let created = 0;
  let existing = 0;

  for (const user of users) {
    const already = await Membership.findOne({
      user: user._id,
      household: user.household,
      status: 'active',
    });
    if (already) {
      existing += 1;
      continue;
    }
    await Membership.create({
      user: user._id,
      household: user.household,
      // The account's own creation time is the closest honest answer to when
      // they joined, and it preserves the order members are listed in — which
      // is what their colours are built on.
      joinedAt: user.createdAt || new Date(),
    });
    created += 1;
  }

  return { users: users.length, created, existing };
}

function nameOf(uri) {
  return (uri.replace(/\/\/[^@]+@/, '//').split('/')[3] || '').split('?')[0];
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

if (require.main === module) {
  (async () => {
    // Production unless asked otherwise would be the wrong default for a
    // script that writes. Development is the default; production is opt-in.
    if (!process.argv.includes('--prod')) process.env.NODE_ENV = 'development';

    const uri = resolveUri();
    if (!uri) {
      console.error('No database URI resolved. Check backend/.env.');
      process.exit(1);
    }

    const dbName = nameOf(uri);
    console.log(`Database: ${dbName}`);

    if (!dbName.endsWith('-dev') && !dbName.endsWith('-test')) {
      const answer = await confirm(`This is not a dev database. Type the database name to continue: `);
      if (answer !== dbName.toLowerCase()) {
        console.log('Stopped. Nothing was written.');
        process.exit(1);
      }
    }

    await mongoose.connect(uri);
    const result = await migrate();
    console.log(`Users with a household: ${result.users}`);
    console.log(`Memberships created:    ${result.created}`);
    console.log(`Already present:        ${result.existing}`);
    await mongoose.disconnect();
  })();
}

module.exports = { migrate };
