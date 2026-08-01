const express = require('express');
const Household = require('../models/Household');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');
const { requireHousehold } = require('../middleware/auth');
const { generateUniqueCode, createHouseholdFor, INVITE_TTL_HOURS, MAX_MEMBERS } = require('../utils/household');

const router = express.Router();
router.use(requireAuth);

// GET /api/households/mine — the caller's household plus its members.
router.get('/mine', requireHousehold, async (req, res) => {
  const household = await Household.findById(req.householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const members = await User.find({ household: household._id }).select('name email');
  const codeIsLive = household.inviteCode && household.inviteCodeExpiresAt > new Date();

  res.json({
    household: {
      id: household._id,
      name: household.name,
      members,
      canInvite: members.length < MAX_MEMBERS,
      // Never echo an expired code back — it would look joinable but fail.
      inviteCode: codeIsLive ? household.inviteCode : null,
      inviteCodeExpiresAt: codeIsLive ? household.inviteCodeExpiresAt : null,
    },
  });
});

// POST /api/households/invite — mint (or re-mint) a join code.
router.post('/invite', requireHousehold, async (req, res) => {
  const household = await Household.findById(req.householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const memberCount = await User.countDocuments({ household: household._id });
  if (memberCount >= MAX_MEMBERS) {
    return res.status(409).json({ error: 'This household is already full' });
  }

  household.inviteCode = await generateUniqueCode();
  household.inviteCodeExpiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  await household.save();

  res.json({ inviteCode: household.inviteCode, expiresAt: household.inviteCodeExpiresAt });
});

// DELETE /api/households/invite — revoke an outstanding code.
router.delete('/invite', requireHousehold, async (req, res) => {
  await Household.findByIdAndUpdate(req.householdId, { inviteCode: null, inviteCodeExpiresAt: null });
  res.json({ ok: true });
});

// POST /api/households/join { code } — move the caller into someone else's
// household. Deliberately NOT behind requireHousehold: the caller still has
// their own (empty) household at this point.
router.post('/join', async (req, res) => {
  const { code } = req.body;
  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  const household = await Household.findOne({ inviteCode: code.trim().toUpperCase() });
  if (!household || !household.inviteCodeExpiresAt || household.inviteCodeExpiresAt < new Date()) {
    return res.status(404).json({ error: 'That invite code is invalid or has expired' });
  }
  if (String(household._id) === String(req.householdId)) {
    return res.status(409).json({ error: 'You are already in this household' });
  }

  const memberCount = await User.countDocuments({ household: household._id });
  if (memberCount >= MAX_MEMBERS) {
    return res.status(409).json({ error: 'This household is already full' });
  }

  const previousHouseholdId = req.householdId;
  await User.findByIdAndUpdate(req.userId, { household: household._id });

  // The joiner's own starter household is now orphaned. It only ever held
  // seeded default categories, so clearing it keeps the database from
  // accumulating abandoned shells — but only if nobody else is left in it.
  if (previousHouseholdId) {
    const remaining = await User.countDocuments({ household: previousHouseholdId });
    if (remaining === 0) {
      const Category = require('../models/Category');
      await Category.deleteMany({ household: previousHouseholdId });
      await Household.findByIdAndDelete(previousHouseholdId);
    }
  }

  // A one-time code stops being useful the moment it's redeemed.
  household.inviteCode = null;
  household.inviteCodeExpiresAt = null;
  await household.save();

  const members = await User.find({ household: household._id }).select('name email');
  res.json({ household: { id: household._id, name: household.name, members } });
});

// POST /api/households/leave { confirmName } — drops the caller out of their
// household and puts them in a fresh empty one.
//
// Records they created stay behind on purpose. Expenses are joint financial
// history: "together" entries were shared costs, and deleting one member's
// rows would retroactively falsify every past month's totals for whoever
// remains. Leaving revokes access; erasing personal data is a separate
// account-deletion concern.
router.post('/leave', requireHousehold, async (req, res) => {
  const { confirmName } = req.body;
  const household = await Household.findById(req.householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  // Typing the name out is the guard against an accidental, unrecoverable tap.
  if (typeof confirmName !== 'string' || confirmName.trim() !== household.name) {
    return res.status(400).json({ error: 'Confirmation text does not match the household name' });
  }

  const others = await User.countDocuments({ household: household._id, _id: { $ne: req.userId } });
  if (others === 0) {
    return res.status(409).json({ error: 'You are the only member — there is nothing to leave' });
  }

  const user = await User.findById(req.userId);
  const fresh = await createHouseholdFor(user);

  res.json({ household: { id: fresh._id, name: fresh.name } });
});

module.exports = router;
