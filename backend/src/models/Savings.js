const mongoose = require('mongoose');
const { CURRENCIES, DEFAULT_CURRENCY } = require('../config/categories');

const savingsSchema = new mongoose.Schema(
  {
    // "personal" entries belong to one owner's individual savings pool;
    // "together" entries belong to the shared/group pool (owner is who logged it,
    // but the balance is combined regardless of who added the entry).
    type: { type: String, enum: ['personal', 'together'], required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: ['deposit', 'withdrawal'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

savingsSchema.index({ date: -1 });

module.exports = mongoose.model('Savings', savingsSchema);
