const express = require('express');
const Savings = require('../models/Savings');
const requireAuth = require('../middleware/auth');
const { CURRENCIES, DEFAULT_CURRENCY } = require('../config/categories');
const { logAction } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// Shared household view — both users see all savings entries (personal and together),
// same transparency model as expenses/events.
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  const query = {};
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      query.date.$lt = end;
    }
  }
  const entries = await Savings.find(query).populate('owner', 'name').sort({ date: -1 });
  res.json({ entries });
});

// GET /api/savings/summary — running balance per type/owner/currency.
router.get('/summary', async (req, res) => {
  const entries = await Savings.find().populate('owner', 'name');

  const personal = {}; // { [ownerName]: { [currency]: balance } }
  const together = {}; // { [currency]: balance }

  for (const e of entries) {
    const signedAmount = e.direction === 'withdrawal' ? -e.amount : e.amount;
    if (e.type === 'personal') {
      const ownerName = e.owner?.name || 'Unknown';
      if (!personal[ownerName]) personal[ownerName] = {};
      personal[ownerName][e.currency] = (personal[ownerName][e.currency] || 0) + signedAmount;
    } else {
      together[e.currency] = (together[e.currency] || 0) + signedAmount;
    }
  }

  res.json({ personal, together });
});

router.post('/', async (req, res) => {
  const { type, owner, direction, amount, currency, description, date } = req.body;

  if (!type || !direction || amount == null) {
    return res.status(400).json({ error: 'type, direction, and amount are required' });
  }
  if (!['personal', 'together'].includes(type)) {
    return res.status(400).json({ error: 'type must be personal or together' });
  }
  if (!['deposit', 'withdrawal'].includes(direction)) {
    return res.status(400).json({ error: 'direction must be deposit or withdrawal' });
  }
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
  }

  const entry = await Savings.create({
    type,
    owner: type === 'personal' && owner ? owner : req.userId,
    direction,
    amount,
    currency: currency || DEFAULT_CURRENCY,
    description: description || '',
    date: date ? new Date(date) : new Date(),
  });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'create',
    entityType: 'savings',
    entityId: entry._id.toString(),
    details: { type: entry.type, direction: entry.direction, amount: entry.amount, currency: entry.currency },
  });

  res.status(201).json({ entry });
});

router.put('/:id', async (req, res) => {
  const { type, owner, direction, amount, currency, description, date } = req.body;
  const entry = await Savings.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const before = { type: entry.type, owner: entry.owner, direction: entry.direction, amount: entry.amount, currency: entry.currency, description: entry.description };

  if (type) {
    if (!['personal', 'together'].includes(type)) {
      return res.status(400).json({ error: 'type must be personal or together' });
    }
    entry.type = type;
  }
  if (entry.type === 'personal' && owner) entry.owner = owner;
  if (direction) {
    if (!['deposit', 'withdrawal'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be deposit or withdrawal' });
    }
    entry.direction = direction;
  }
  if (amount != null) entry.amount = amount;
  if (currency) {
    if (!CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
    }
    entry.currency = currency;
  }
  if (description != null) entry.description = description;
  if (date) entry.date = new Date(date);

  await entry.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'update',
    entityType: 'savings',
    entityId: entry._id.toString(),
    details: { before, after: { direction: entry.direction, amount: entry.amount, currency: entry.currency, description: entry.description } },
  });

  res.json({ entry });
});

router.delete('/:id', async (req, res) => {
  const entry = await Savings.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'delete',
    entityType: 'savings',
    entityId: entry._id.toString(),
    details: { type: entry.type, direction: entry.direction, amount: entry.amount, currency: entry.currency },
  });

  await entry.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
