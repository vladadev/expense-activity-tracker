const express = require('express');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Only the "money & planning" entities are notification-worthy — logins,
// category renames, and push-token registration are too noisy to surface
// as a notification to your partner.
const NOTIFIABLE_ENTITIES = ['expense', 'event', 'savings', 'income', 'wishlistItem'];

// GET /api/notifications — the OTHER person's actions only (per household
// transparency model, seeing your own actions echoed back isn't useful).
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const me = await User.findById(req.userId).select('notificationsSeenAt');

  const logs = await AuditLog.find({
    entityType: { $in: NOTIFIABLE_ENTITIES },
    user: { $ne: req.userId },
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  const seenAt = me?.notificationsSeenAt;
  const notifications = logs.map((log) => ({
    ...log.toObject(),
    read: seenAt ? log.createdAt <= seenAt : false,
  }));

  res.json({ notifications });
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  const me = await User.findById(req.userId).select('notificationsSeenAt');

  const query = {
    entityType: { $in: NOTIFIABLE_ENTITIES },
    user: { $ne: req.userId },
  };
  if (me?.notificationsSeenAt) {
    query.createdAt = { $gt: me.notificationsSeenAt };
  }

  const count = await AuditLog.countDocuments(query);
  res.json({ count });
});

// POST /api/notifications/seen — marks "now" as the last-seen point, clearing the badge.
router.post('/seen', async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { notificationsSeenAt: new Date() });
  res.json({ ok: true });
});

module.exports = router;
