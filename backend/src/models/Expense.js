const mongoose = require('mongoose');
const { EXPENSE_TYPES, CURRENCIES, DEFAULT_CURRENCY } = require('../config/categories');

const expenseSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    // Free-form now — validated against the user-managed Category collection
    // (scope: 'expense') at the route level instead of a fixed enum.
    category: { type: String, required: true },
    type: { type: String, enum: EXPENSE_TYPES, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound and household-first: every query filters by household, so it must
// be the leading field for the index to actually be used.
expenseSchema.index({ household: 1, date: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
