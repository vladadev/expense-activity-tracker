const Household = require('../models/Household');
const Category = require('../models/Category');
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_EVENT_CATEGORIES } = require('../config/categories');

// Unambiguous alphabet: no O/0, I/1, or similar-looking pairs, because these
// codes get read aloud or typed from a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const INVITE_TTL_HOURS = 72;
// Two people per household for now; raising this is a one-line change.
const MAX_MEMBERS = 2;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Retries on the (unlikely) chance of colliding with a live code.
async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const taken = await Household.exists({ inviteCode: code });
    if (!taken) return code;
  }
  throw new Error('Could not generate a unique invite code');
}

// Every new account gets its own household immediately, so the app is fully
// usable alone — inviting a partner is an optional step afterwards, not a
// prerequisite for doing anything.
async function createHouseholdFor(user, name) {
  const household = await Household.create({
    name: name || `${user.name}'s household`,
    createdBy: user._id,
  });

  const defaults = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((n) => ({ name: n, scope: 'expense' })),
    ...DEFAULT_EVENT_CATEGORIES.map((n) => ({ name: n, scope: 'event' })),
  ];
  await Category.insertMany(
    defaults.map(({ name: categoryName, scope }, index) => ({
      household: household._id,
      name: categoryName,
      scope,
      order: index,
      createdBy: user._id,
    }))
  );

  user.household = household._id;
  await user.save();
  return household;
}

module.exports = { generateUniqueCode, createHouseholdFor, INVITE_TTL_HOURS, MAX_MEMBERS };
