const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
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
  logAction({ userId: user._id, userName: user.name, action: 'login', entityType: 'auth' });
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email },
  });
});

// Stateless JWT — logout is a client-side token clear. This endpoint exists
// so the client has a consistent call to make (and a hook point later if we
// ever add refresh tokens / a denylist).
router.post('/logout', requireAuth, (req, res) => {
  logAction({ userId: req.userId, userName: req.userName, action: 'logout', entityType: 'auth' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('name email');
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Shaped the same as /login's response (id, not _id) so the client can
  // rely on user.id consistently whether it just logged in or restored
  // an existing session on app restart.
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
});

// Both household accounts — used to pick "whose personal savings" etc.
router.get('/users', requireAuth, async (req, res) => {
  const users = await User.find().select('name email');
  res.json({ users });
});

module.exports = router;
