// One-time script to populate the default set of user-editable categories.
// Run with: npm run seed:categories
require('dotenv').config();
const connectDB = require('../config/db');
const Category = require('../models/Category');
const User = require('../models/User');
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_EVENT_CATEGORIES } = require('../config/categories');

async function seed() {
  await connectDB();

  const anyUser = await User.findOne();
  if (!anyUser) {
    console.log('No users found — run "npm run seed" first to create accounts.');
    process.exit(1);
  }

  const toSeed = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name, scope: 'expense' })),
    ...DEFAULT_EVENT_CATEGORIES.map((name) => ({ name, scope: 'event' })),
  ];

  for (const { name, scope } of toSeed) {
    const existing = await Category.findOne({ scope, name });
    if (existing) {
      console.log(`Already exists: [${scope}] ${name}`);
      continue;
    }
    await Category.create({ name, scope, createdBy: anyUser._id });
    console.log(`Created: [${scope}] ${name}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
