const mongoose = require('mongoose');

// User-managed categories, replacing what used to be hardcoded enums.
// "type" here means which part of the app the category belongs to
// (expense categories, event categories, wishlist folders) — not to be
// confused with an Expense's personal/together type, which stays fixed.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // 'todo' folders power the To-Do half of the Lists tab — same mechanics
    // as wishlist folders, just without prices/links on their items.
    scope: { type: String, enum: ['expense', 'event', 'wishlist', 'todo'], required: true },
    // Wishlist/todo folders can nest via parent; null = root.
    // Other scopes never set this.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // Manual sort position among sibling folders.
    order: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Names must be unique among siblings (same scope + same parent), so two
// different folders can each have e.g. an "Ostalo" subfolder.
categorySchema.index({ scope: 1, parent: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
