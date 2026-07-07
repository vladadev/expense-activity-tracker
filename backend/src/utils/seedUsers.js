// One-time script to create the 2 accounts for this app (no public signup).
// Run with: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

async function seed() {
  await connectDB();

  const seeds = [
    {
      name: process.env.SEED_USER_1_NAME,
      email: process.env.SEED_USER_1_EMAIL,
      password: process.env.SEED_USER_1_PASSWORD,
    },
    {
      name: process.env.SEED_USER_2_NAME,
      email: process.env.SEED_USER_2_EMAIL,
      password: process.env.SEED_USER_2_PASSWORD,
    },
  ];

  for (const s of seeds) {
    if (!s.email || !s.password) {
      console.log(`Skipping seed user "${s.name}" — missing email/password in .env`);
      continue;
    }
    const existing = await User.findOne({ email: s.email.toLowerCase() });
    if (existing) {
      console.log(`User already exists: ${s.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(s.password, 10);
    await User.create({ name: s.name, email: s.email, passwordHash });
    console.log(`Created user: ${s.email}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
