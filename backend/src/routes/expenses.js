const express = require('express');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const requireAuth = require('../middleware/auth');
const { EXPENSE_TYPES, CURRENCIES, DEFAULT_CURRENCY } = require('../config/categories');
const { logAction } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

async function categoryExists(name) {
  return Category.exists({ scope: 'expense', name });
}

// GET /api/expenses?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns expenses for BOTH users (shared household view), not just req.userId,
// since "together" expenses and each other's spend are meant to be visible.
router.get('/', async (req, res) => {
  const { date, from, to } = req.query;
  const query = {};

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    query.date = { $gte: start, $lt: end };
  } else if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const expenses = await Expense.find(query).populate('owner', 'name').sort({ date: -1 });
  res.json({ expenses });
});

router.post('/', async (req, res) => {
  const { amount, category, type, description, date, currency } = req.body;

  if (amount == null || !category || !type) {
    return res.status(400).json({ error: 'amount, category, and type are required' });
  }
  if (!(await categoryExists(category))) {
    return res.status(400).json({ error: `Unknown category: ${category}` });
  }
  if (!EXPENSE_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${EXPENSE_TYPES.join(', ')}` });
  }
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
  }

  // Defaults to "now" unless the client explicitly passes a date
  // (e.g. logging an expense while browsing a past date in the calendar).
  const expense = await Expense.create({
    owner: req.userId,
    date: date ? new Date(date) : new Date(),
    amount,
    currency: currency || DEFAULT_CURRENCY,
    category,
    type,
    description: description || '',
  });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'create',
    entityType: 'expense',
    entityId: expense._id.toString(),
    details: { amount: expense.amount, currency: expense.currency, category: expense.category, type: expense.type },
  });

  res.status(201).json({ expense });
});

router.put('/:id', async (req, res) => {
  const { amount, category, type, description, date, currency } = req.body;
  const expense = await Expense.findById(req.params.id);

  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  // Both accounts have full edit/delete privileges over all household data,
  // not just their own entries — this is a shared household tracker for 2 people.

  const before = { amount: expense.amount, currency: expense.currency, category: expense.category, type: expense.type, description: expense.description, date: expense.date };

  if (amount != null) expense.amount = amount;
  if (category) {
    if (!(await categoryExists(category))) {
      return res.status(400).json({ error: `Unknown category: ${category}` });
    }
    expense.category = category;
  }
  if (type) {
    if (!EXPENSE_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${EXPENSE_TYPES.join(', ')}` });
    }
    expense.type = type;
  }
  if (currency) {
    if (!CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
    }
    expense.currency = currency;
  }
  if (description != null) expense.description = description;
  if (date) expense.date = new Date(date);

  await expense.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'update',
    entityType: 'expense',
    entityId: expense._id.toString(),
    details: { before, after: { amount: expense.amount, currency: expense.currency, category: expense.category, type: expense.type, description: expense.description, date: expense.date } },
  });

  res.json({ expense });
});

router.delete('/:id', async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'delete',
    entityType: 'expense',
    entityId: expense._id.toString(),
    details: { amount: expense.amount, category: expense.category, type: expense.type, description: expense.description },
  });

  await expense.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
