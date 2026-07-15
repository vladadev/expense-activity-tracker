const express = require('express');
const Income = require('../models/Income');
const requireAuth = require('../middleware/auth');
const { CURRENCIES, DEFAULT_CURRENCY } = require('../config/categories');
const { logAction } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// Shared household view — both users see all income entries, same
// transparency model as expenses/savings/events.
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
  const entries = await Income.find(query).populate('owner', 'name').sort({ date: -1 });
  res.json({ entries });
});

router.post('/', async (req, res) => {
  const { amount, currency, description, date } = req.body;
  if (amount == null) {
    return res.status(400).json({ error: 'amount is required' });
  }
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
  }

  const entry = await Income.create({
    owner: req.userId,
    amount,
    currency: currency || DEFAULT_CURRENCY,
    description: description || '',
    date: date ? new Date(date) : new Date(),
  });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'create',
    entityType: 'income',
    entityId: entry._id.toString(),
    details: { amount: entry.amount, currency: entry.currency, description: entry.description },
  });

  res.status(201).json({ entry });
});

router.put('/:id', async (req, res) => {
  const { amount, currency, description, date } = req.body;
  const entry = await Income.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const before = { amount: entry.amount, currency: entry.currency, description: entry.description };

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
    entityType: 'income',
    entityId: entry._id.toString(),
    details: { before, after: { amount: entry.amount, currency: entry.currency, description: entry.description } },
  });

  res.json({ entry });
});

router.delete('/:id', async (req, res) => {
  const entry = await Income.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'delete',
    entityType: 'income',
    entityId: entry._id.toString(),
    details: { amount: entry.amount, currency: entry.currency, description: entry.description },
  });

  await entry.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
