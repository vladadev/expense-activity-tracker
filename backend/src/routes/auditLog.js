const express = require('express');
const AuditLog = require('../models/AuditLog');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/audit-log?limit=100 — most recent actions first, shared household view.
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ logs });
});

module.exports = router;
