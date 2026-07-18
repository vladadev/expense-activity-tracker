const mongoose = require('mongoose');

// User-managed categories, replacing what used to be hardcoded enums.
// "type" here means which part of the app the category belongs to
// (expense categories, event categories, wishlist folders) — not to be
// confused with an Expense's personal/together type, which stays fixed.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ['expense', 'event', 'wishlist'], required: true },
    // Wishlist folders can nest one level (or more) via parent; null = root.
    // Other scopes never set this.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Names must be unique among siblings (same scope + same parent), so two
// different folders can each have e.g. an "Ostalo" subfolder.
categorySchema.index({ scope: 1, parent: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
