// One-time migration: moves a single-tenant database (every user sees every
// record) into the household model (every record belongs to one household).
//
// Safe to run more than once — records that already carry a household are
// left alone, so a partial run can simply be repeated.
//
// Run with: npm run migrate:households
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Household = require('../models/Household');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Event = require('../models/Event');
const Income = require('../models/Income');
const Savings = require('../models/Savings');
const Category = require('../models/Category');
const WishlistItem = require('../models/WishlistItem');
const AuditLog = require('../models/AuditLog');

const DATA_MODELS = [
  ['expenses', Expense],
  ['events', Event],
  ['income', Income],
  ['savings', Savings],
  ['categories', Category],
  ['wishlist items', WishlistItem],
  ['audit logs', AuditLog],
];

async function migrate() {
  await connectDB();

  const users = await User.find().sort({ createdAt: 1 });
  if (users.length === 0) {
    console.log('No users found — nothing to migrate.');
    process.exit(0);
  }

  console.log(`Found ${users.length} user(s): ${users.map((u) => u.name).join(', ')}`);

  // Everyone currently shares one dataset, so they all belong in one household.
  let household = await Household.findOne();
  if (household) {
    console.log(`Reusing existing household: "${household.name}"`);
  } else {
    household = await Household.create({
      name: users.map((u) => u.name).join(' & '),
      createdBy: users[0]._id,
    });
    console.log(`Created household: "${household.name}" (${household._id})`);
  }

  const userResult = await User.updateMany(
    { $or: [{ household: null }, { household: { $exists: false } }] },
    { household: household._id }
  );
  console.log(`Users linked to household: ${userResult.modifiedCount}`);

  let total = 0;
  for (const [label, Model] of DATA_MODELS) {
    const result = await Model.updateMany(
      { $or: [{ household: null }, { household: { $exists: false } }] },
      { household: household._id }
    );
    console.log(`  ${label}: ${result.modifiedCount} stamped`);
    total += result.modifiedCount;
  }

  // The Category unique index changed shape (household now leads it). Dropping
  // the stale one prevents "duplicate key" errors when a second household
  // later creates a category with a name the first one already used.
  try {
    await mongoose.connection.db.collection('categories').dropIndex('scope_1_parent_1_name_1');
    console.log('Dropped obsolete category index scope_1_parent_1_name_1');
  } catch (e) {
    console.log(`Old category index: ${e.message}`);
  }

  for (const [, Model] of DATA_MODELS) await Model.syncIndexes();
  await User.syncIndexes();
  await Household.syncIndexes();
  console.log('Indexes synced');

  // Verify nothing was left behind before declaring success.
  let orphans = 0;
  for (const [label, Model] of DATA_MODELS) {
    const count = await Model.countDocuments({
      $or: [{ household: null }, { household: { $exists: false } }],
    });
    if (count > 0) {
      console.error(`  WARNING: ${count} ${label} still have no household`);
      orphans += count;
    }
  }

  console.log(`\n${total} records migrated into "${household.name}".`);
  console.log(orphans === 0 ? 'Verification passed — no orphaned records.' : `Verification FAILED — ${orphans} orphans.`);
  process.exit(orphans === 0 ? 0 : 1);
}

migrate().catch((err) => {
  console.error('Migration FAILED:', err);
  process.exit(1);
});
