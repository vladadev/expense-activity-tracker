const express = require('express');
const Expense = require('../models/Expense');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function emptyCurrencyBucket() {
  return {
    total: 0,
    personalTotal: 0,
    togetherTotal: 0,
    byCategory: {},
    // Same category rollup split by expense type, so clients can filter
    // charts to personal/together without refetching raw expenses.
    byCategoryPersonal: {},
    byCategoryTogether: {},
    byOwner: {},
  };
}

// GET /api/stats/:date  (YYYY-MM-DD) — full breakdown for one day, grouped by currency.
// No cross-currency conversion — each currency gets its own totals so figures
// always match exactly what was actually spent.
router.get('/:date', async (req, res) => {
  const start = new Date(req.params.date);
  const end = new Date(req.params.date);
  end.setDate(end.getDate() + 1);

  const expenses = await Expense.find({ date: { $gte: start, $lt: end } }).populate('owner', 'name');

  const byCurrency = {};

  for (const e of expenses) {
    if (!byCurrency[e.currency]) byCurrency[e.currency] = emptyCurrencyBucket();
    const bucket = byCurrency[e.currency];

    bucket.total += e.amount;
    if (e.type === 'personal') bucket.personalTotal += e.amount;
    else bucket.togetherTotal += e.amount;

    bucket.byCategory[e.category] = (bucket.byCategory[e.category] || 0) + e.amount;

    const ownerName = e.owner?.name || 'Unknown';
    if (!bucket.byOwner[ownerName]) {
      bucket.byOwner[ownerName] = { total: 0, personal: 0, together: 0 };
    }
    bucket.byOwner[ownerName].total += e.amount;
    bucket.byOwner[ownerName][e.type] += e.amount;
  }

  res.json({ date: req.params.date, byCurrency, expenses });
});

// GET /api/stats/range/:from/:to — for monthly graphs, grouped by day then currency,
// plus a currency-level rollup (byCategory, byOwner) covering the whole range.
router.get('/range/:from/:to', async (req, res) => {
  const start = new Date(req.params.from);
  const end = new Date(req.params.to);
  end.setDate(end.getDate() + 1);

  const expenses = await Expense.find({ date: { $gte: start, $lt: end } }).populate('owner', 'name');

  const byDay = {};
  const byCurrency = {};

  for (const e of expenses) {
    const day = e.date.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = {};
    if (!byDay[day][e.currency]) byDay[day][e.currency] = { total: 0, personal: 0, together: 0 };
    byDay[day][e.currency].total += e.amount;
    byDay[day][e.currency][e.type] += e.amount;

    if (!byCurrency[e.currency]) byCurrency[e.currency] = emptyCurrencyBucket();
    const bucket = byCurrency[e.currency];
    bucket.total += e.amount;
    if (e.type === 'personal') bucket.personalTotal += e.amount;
    else bucket.togetherTotal += e.amount;
    bucket.byCategory[e.category] = (bucket.byCategory[e.category] || 0) + e.amount;
    const typeCats = e.type === 'personal' ? bucket.byCategoryPersonal : bucket.byCategoryTogether;
    typeCats[e.category] = (typeCats[e.category] || 0) + e.amount;

    const ownerName = e.owner?.name || 'Unknown';
    if (!bucket.byOwner[ownerName]) bucket.byOwner[ownerName] = { total: 0, personal: 0, together: 0 };
    bucket.byOwner[ownerName].total += e.amount;
    bucket.byOwner[ownerName][e.type] += e.amount;
  }

  res.json({ from: req.params.from, to: req.params.to, byDay, byCurrency });
});

module.exports = router;
