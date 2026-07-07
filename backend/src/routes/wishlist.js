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
  const items = await WishlistItem.find(query).populate('addedBy', 'name').sort({ createdAt: -1 });
  res.json({ items });
});

router.post('/items', async (req, res) => {
  const { category, title, price, currency, link, notes } = req.body;
  if (!category || !title) {
    return res.status(400).json({ error: 'category and title are required' });
  }
  const folder = await Category.findOne({ _id: category, scope: 'wishlist' });
  if (!folder) return res.status(400).json({ error: 'Unknown wishlist folder' });
  if (currency && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
  }

  const item = await WishlistItem.create({
    category,
    title,
    price: price ?? null,
    currency: currency || null,
    link: link || '',
    notes: notes || '',
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
  if (purchased != null) item.purchased = purchased;
  if (category) {
    const folder = await Category.findOne({ _id: category, scope: 'wishlist' });
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
