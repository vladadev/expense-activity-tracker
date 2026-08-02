// Changes an account's password. Exists because the app has no
// change-password screen yet, and a password that has been written down
// somewhere (a chat, a note, an old .env) needs a way to be retired.
//
// The new password is typed at the prompt, never passed as an argument —
// command-line arguments end up in shell history.
//
// Usage: npm run change:password -- someone@example.com
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const MIN_LENGTH = 8;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run change:password -- <email>');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  console.log(`Changing the password for: ${user.name} (${user.email})\n`);
  const password = await ask('New password: ');
  if (!password || password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  const confirm = await ask('Repeat it: ');
  if (password !== confirm) {
    console.error('The two entries do not match — nothing was changed.');
    process.exit(1);
  }

  const samePassword = await bcrypt.compare(password, user.passwordHash);
  if (samePassword) {
    console.error('That is the current password — choose a different one.');
    process.exit(1);
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  console.log(`\nPassword updated for ${user.email}.`);
  console.log('Existing sessions stay signed in (tokens are valid for 30 days).');
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
