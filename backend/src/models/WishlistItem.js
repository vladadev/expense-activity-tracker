const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/categories');

const wishlistItemSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
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
    // Optional push reminder, same mechanics as Event reminders. Mainly for
    // To-Do tasks ("call the landlord at 5pm") but available on any item.
    reminderEnabled: { type: Boolean, default: false },
    reminderAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

wishlistItemSchema.index({ household: 1, category: 1 });
wishlistItemSchema.index({ reminderAt: 1, reminderSent: 1 });

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);
