const mongoose = require('mongoose');

// User-managed categories, replacing what used to be hardcoded enums.
// "type" here means which part of the app the category belongs to
// (expense categories, event categories, wishlist folders) — not to be
// confused with an Expense's personal/together type, which stays fixed.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ['expense', 'event', 'wishlist'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

categorySchema.index({ scope: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
