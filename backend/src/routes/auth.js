const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const { createHouseholdFor } = require('../utils/household');

const router = express.Router();

// POST /api/auth/register — creates the account AND its own household, so a
// new user can start tracking immediately and invite a partner later.
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (!name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name: name.trim(), email: email.toLowerCase(), passwordHash });
  const household = await createHouseholdFor(user);

  const token = signToken(user);
  logAction({
    userId: user._id,
    userName: user.name,
    householdId: household._id,
    action: 'create',
    entityType: 'auth',
  });

  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, household: household._id },
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  // Type check, not just truthiness: a JSON body can smuggle an object like
  // {"$ne": null} here, which Mongo would happily treat as a query operator.
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  logAction({
    userId: user._id,
    userName: user.name,
    householdId: user.household,
    action: 'login',
    entityType: 'auth',
  });
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, household: user.household },
  });
});

// POST /api/auth/change-password — requires the current password, so a phone
// left unlocked can't be used to lock the owner out of their own account.
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Both the current and the new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'The new password must be different from the current one' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    householdId: req.householdId,
    action: 'update',
    entityType: 'auth',
    // Deliberately no password material in the audit trail.
    details: { change: 'password' },
  });

  res.json({ ok: true });
});

// Stateless JWT — logout is a client-side token clear. This endpoint exists
// so the client has a consistent call to make (and a hook point later if we
// ever add refresh tokens / a denylist).
router.post('/logout', requireAuth, (req, res) => {
  logAction({
    userId: req.userId,
    userName: req.userName,
    householdId: req.householdId,
    action: 'logout',
    entityType: 'auth',
  });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('name email household');
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Shaped the same as /login's response (id, not _id) so the client can
  // rely on user.id consistently whether it just logged in or restored
  // an existing session on app restart.
  res.json({ user: { id: user._id, name: user.name, email: user.email, household: user.household } });
});

// Members of the caller's household — used to pick "whose personal savings"
// etc. Scoped: unscoped, this leaked every account on the server.
router.get('/users', requireAuth, async (req, res) => {
  if (!req.householdId) return res.json({ users: [] });
  const users = await User.find({ household: req.householdId }).select('name email');
  res.json({ users });
});

module.exports = router;
