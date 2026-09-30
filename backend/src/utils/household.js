const Household = require('../models/Household');
const Category = require('../models/Category');
const Membership = require('../models/Membership');
const User = require('../models/User');
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_EVENT_CATEGORIES } = require('../config/categories');

// Unambiguous alphabet: no O/0, I/1, or similar-looking pairs, because these
// codes get read aloud or typed from a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const INVITE_TTL_HOURS = 72;
// Six is a household, not a company. The number exists so an invite code
// cannot quietly become a public door.
const MAX_MEMBERS = 6;

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

  await Membership.create({ user: user._id, household: household._id });

  // The legacy field records a person's FIRST household and is not maintained
  // after that. It survives only so a request from an app version that does
  // not send the household header still has somewhere to land; membership is
  // the real answer.
  if (!user.household) {
    user.household = household._id;
    await user.save();
  }
  return household;
}

// Live members of a household, oldest first. The order is not decoration: a
// member's colour comes from their position in this list.
async function membersOf(householdId) {
  const memberships = await Membership.find({ household: householdId, status: 'active' })
    .sort({ joinedAt: 1 })
    .select('user joinedAt');

  const users = await User.find({ _id: { $in: memberships.map((m) => m.user) } }).select('name email');
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return memberships
    .map((m) => {
      const user = byId.get(String(m.user));
      if (!user) return null;
      return { _id: user._id, name: user.name, email: user.email, joinedAt: m.joinedAt };
    })
    .filter(Boolean);
}

module.exports = { generateUniqueCode, createHouseholdFor, membersOf, INVITE_TTL_HOURS, MAX_MEMBERS };
