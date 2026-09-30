const express = require('express');
const Household = require('../models/Household');
const Membership = require('../models/Membership');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');
const { requireHousehold } = require('../middleware/auth');
const {
  generateUniqueCode,
  createHouseholdFor,
  membersOf,
  INVITE_TTL_HOURS,
  MAX_MEMBERS,
} = require('../utils/household');

const router = express.Router();
router.use(requireAuth);

// GET /api/households — every household the caller belongs to, oldest first.
// This is what the switcher in the app is built from, so it stays cheap: names
// and member counts, no contents.
router.get('/', async (req, res) => {
  const memberships = await Membership.find({ user: req.userId, status: 'active' }).sort({ joinedAt: 1 });
  const ids = memberships.map((m) => m.household);
  const households = await Household.find({ _id: { $in: ids } }).select('name');
  const byId = new Map(households.map((h) => [String(h._id), h]));

  const counts = await Membership.aggregate([
    { $match: { household: { $in: ids }, status: 'active' } },
    { $group: { _id: '$household', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    households: memberships
      .map((m) => {
        const household = byId.get(String(m.household));
        if (!household) return null;
        return {
          id: household._id,
          name: household.name,
          memberCount: countById.get(String(household._id)) || 1,
          joinedAt: m.joinedAt,
        };
      })
      .filter(Boolean),
  });
});

// GET /api/households/mine — the household this request is acting in, plus its
// members.
router.get('/mine', requireHousehold, async (req, res) => {
  const household = await Household.findById(req.householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const members = await membersOf(household._id);
  const codeIsLive = household.inviteCode && household.inviteCodeExpiresAt > new Date();

  res.json({
    household: {
      id: household._id,
      name: household.name,
      members,
      canInvite: members.length < MAX_MEMBERS,
      // Never echo an expired code back, it would look joinable but fail.
      inviteCode: codeIsLive ? household.inviteCode : null,
      inviteCodeExpiresAt: codeIsLive ? household.inviteCodeExpiresAt : null,
    },
  });
});

// POST /api/households { name } — start another one. Someone can keep their
// own money separate from the one they share, which is the whole point of
// belonging to several.
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Household name cannot be empty' });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });

  const household = await createHouseholdFor(user, name && name.trim());
  res.status(201).json({ household: { id: household._id, name: household.name, memberCount: 1 } });
});

// POST /api/households/invite — mint (or re-mint) a join code.
router.post('/invite', requireHousehold, async (req, res) => {
  const household = await Household.findById(req.householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const memberCount = await Membership.countDocuments({ household: household._id, status: 'active' });
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

// POST /api/households/join { code } — join a household by its code.
//
// It ADDS a household rather than moving between them. The caller keeps their
// own, which is where their private spending lives, and gains access to the
// shared one. Before households were plural this had to move the person and
// then delete the shell they left behind; that shell is now somewhere they
// still use.
router.post('/join', async (req, res) => {
  const { code } = req.body;
  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  const household = await Household.findOne({ inviteCode: code.trim().toUpperCase() });
  if (!household || !household.inviteCodeExpiresAt || household.inviteCodeExpiresAt < new Date()) {
    return res.status(404).json({ error: 'That invite code is invalid or has expired' });
  }

  const already = await Membership.findOne({
    user: req.userId,
    household: household._id,
    status: 'active',
  });
  if (already) {
    return res.status(409).json({ error: 'You are already in this household' });
  }

  const memberCount = await Membership.countDocuments({ household: household._id, status: 'active' });
  if (memberCount >= MAX_MEMBERS) {
    return res.status(409).json({ error: 'This household is already full' });
  }

  await Membership.create({ user: req.userId, household: household._id });

  // A one-time code stops being useful the moment it is redeemed.
  household.inviteCode = null;
  household.inviteCodeExpiresAt = null;
  await household.save();

  const members = await membersOf(household._id);
  res.json({ household: { id: household._id, name: household.name, members } });
});

// POST /api/households/leave { confirmName } — give up access to a household.
//
// Records the leaver created stay behind on purpose. Expenses are joint
// financial history: together entries were shared costs, and removing one
// person's rows would retroactively falsify every past month for whoever
// remains. Leaving revokes access; it does not rewrite the past.
router.post('/leave', requireHousehold, async (req, res) => {
  const { confirmName } = req.body;
  const household = await Household.findById(req.householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  // Typing the name out is the guard against an accidental, unrecoverable tap.
  if (typeof confirmName !== 'string' || confirmName.trim() !== household.name) {
    return res.status(400).json({ error: 'Confirmation text does not match the household name' });
  }

  const others = await Membership.countDocuments({
    household: household._id,
    status: 'active',
    user: { $ne: req.userId },
  });
  if (others === 0) {
    return res.status(409).json({ error: 'You are the only member, there is nothing to leave' });
  }

  await Membership.findOneAndUpdate(
    { user: req.userId, household: household._id, status: 'active' },
    { status: 'left', leftAt: new Date() }
  );

  // Nobody is left without somewhere to be. Someone whose only household was
  // the one they just left gets a fresh empty one rather than an app with
  // nothing in it.
  const remaining = await Membership.countDocuments({ user: req.userId, status: 'active' });
  if (remaining === 0) {
    const user = await User.findById(req.userId);
    const fresh = await createHouseholdFor(user);
    return res.json({ household: { id: fresh._id, name: fresh.name } });
  }

  const next = await Membership.findOne({ user: req.userId, status: 'active' }).sort({ joinedAt: 1 });
  const nextHousehold = await Household.findById(next.household).select('name');
  res.json({ household: { id: nextHousehold._id, name: nextHousehold.name } });
});

module.exports = router;
