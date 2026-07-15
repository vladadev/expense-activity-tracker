// One-time cleanup script — wipes all date-tied transaction history
// (expenses, events, savings, income, audit log) while keeping user
// accounts, categories, and wishlist folders/items untouched.
// Run with: npm run reset:data
require('dotenv').config();
const connectDB = require('../config/db');
const Expense = require('../models/Expense');
const Event = require('../models/Event');
const Savings = require('../models/Savings');
const Income = require('../models/Income');
const AuditLog = require('../models/AuditLog');

async function reset() {
  await connectDB();

  const [expenses, events, savings, income, auditLog] = await Promise.all([
    Expense.deleteMany({}),
    Event.deleteMany({}),
    Savings.deleteMany({}),
    Income.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log(`Deleted ${expenses.deletedCount} expenses`);
  console.log(`Deleted ${events.deletedCount} events`);
  console.log(`Deleted ${savings.deletedCount} savings entries`);
  console.log(`Deleted ${income.deletedCount} income entries`);
  console.log(`Deleted ${auditLog.deletedCount} audit log entries`);
  console.log('Users, categories, and wishlist items were left untouched.');

  process.exit(0);
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
