const express = require('express');
const WishlistItem = require('../models/WishlistItem');
const Category = require('../models/Category');
const requireAuth = require('../middleware/auth');
const { CURRENCIES } = require('../config/categories');
const { logAction } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// Shared household view — both users see and can edit the full wishlist.
router.get('/items', async (req, res) => {
  const { category } = req.query;
  const query = {};
  if (category) query.category = category;
  const items = await WishlistItem.find(query).populate('addedBy', 'name').sort({ order: 1, createdAt: -1 });
  res.json({ items });
});

// PUT /items/reorder — bulk-persist a manual sort order. Must be registered
// before /items/:id so "reorder" isn't parsed as an item id.
router.put('/items/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  await Promise.all(ids.map((id, index) => WishlistItem.updateOne({ _id: id }, { order: index })));
  res.json({ ok: true });
});

router.post('/items', async (req, res) => {
  const { category, title, price, currency, link, notes } = req.body;
  if (!category || !title) {
    return res.status(400).json({ error: 'category and title are required' });
  }
  const folder = await Category.findOne({ _id: category, scope: { $in: ['wishlist', 'todo'] } });
  if (!folder) return res.status(400).json({ error: 'Unknown wishlist folder' });
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
  }

  // New items go to the end of the unpurchased list.
  const last = await WishlistItem.findOne({ category }).sort({ order: -1 }).select('order');
  const item = await WishlistItem.create({
    category,
    title,
    price: price ?? null,
    currency: currency || null,
    link: link || '',
    notes: notes || '',
    order: (last?.order ?? -1) + 1,
    addedBy: req.userId,
  });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'create',
    entityType: 'wishlistItem',
    entityId: item._id.toString(),
    details: { title: item.title, folder: folder.name },
  });

  res.status(201).json({ item });
});

router.put('/items/:id', async (req, res) => {
  const { title, price, currency, link, notes, purchased, category } = req.body;
  const item = await WishlistItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const before = { title: item.title, purchased: item.purchased };

  if (title) item.title = title;
  if (price !== undefined) item.price = price;
  if (currency !== undefined) {
    if (currency && !CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
    }
    item.currency = currency || null;
  }
  if (link != null) item.link = link;
  if (notes != null) item.notes = notes;
  if (purchased != null && purchased !== item.purchased) {
    item.purchased = purchased;
    if (purchased) {
      item.purchasedAt = new Date();
    } else {
      // Un-checking puts the item back at the end of the unpurchased list.
      item.purchasedAt = null;
      const last = await WishlistItem.findOne({ category: item.category, purchased: false })
        .sort({ order: -1 })
        .select('order');
      item.order = (last?.order ?? -1) + 1;
    }
  }
  if (category) {
    const folder = await Category.findOne({ _id: category, scope: { $in: ['wishlist', 'todo'] } });
    if (!folder) return res.status(400).json({ error: 'Unknown wishlist folder' });
    item.category = category;
  }

  await item.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'update',
    entityType: 'wishlistItem',
    entityId: item._id.toString(),
    details: { before, after: { title: item.title, purchased: item.purchased } },
  });

  res.json({ item });
});

router.delete('/items/:id', async (req, res) => {
  const item = await WishlistItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'delete',
    entityType: 'wishlistItem',
    entityId: item._id.toString(),
    details: { title: item.title },
  });

  await item.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
