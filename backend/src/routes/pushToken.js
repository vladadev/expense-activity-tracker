const express = require('express');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();
// No requireHousehold here: registering a device token is about the account
// itself, and must keep working during the brief window before a freshly
// registered user has a household.
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken) {
    return res.status(400).json({ error: 'expoPushToken is required' });
  }
  await User.findByIdAndUpdate(req.userId, { expoPushToken });
  res.json({ ok: true });
});

module.exports = router;
