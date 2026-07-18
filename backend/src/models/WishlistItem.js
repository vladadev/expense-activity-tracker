const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/categories');

const wishlistItemSchema = new mongoose.Schema(
  {
    // Folders are Category documents with scope: 'wishlist' (e.g. "Temu", "Groceries").
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    title: { type: String, required: true },
    price: { type: Number, default: null, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: null },
    link: { type: String, default: '' },
    notes: { type: String, default: '' },
    purchased: { type: Boolean, default: false },
    // When the item was checked off — purchased items sort newest-first.
    purchasedAt: { type: Date, default: null },
    // Manual sort position among unpurchased items in the same folder.
    order: { type: Number, default: 0 },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

wishlistItemSchema.index({ category: 1 });

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);
