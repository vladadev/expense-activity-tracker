const mongoose = require('mongoose');
const { CURRENCIES, DEFAULT_CURRENCY } = require('../config/categories');

// Deposit-only, unlike Savings (which has deposit/withdrawal) — if an income
// entry was a mistake, just delete it rather than "withdrawing" income.
const incomeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

incomeSchema.index({ date: -1 });

module.exports = mongoose.model('Income', incomeSchema);
