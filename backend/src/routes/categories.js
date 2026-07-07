const express = require('express');
const Category = require('../models/Category');
const WishlistItem = require('../models/WishlistItem');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const SCOPES = ['expense', 'event', 'wishlist'];

const router = express.Router();
router.use(requireAuth);

// GET /api/categories?scope=expense — shared household view, all categories visible to both users.
router.get('/', async (req, res) => {
  const { scope } = req.query;
  const query = {};
  if (scope) {
    if (!SCOPES.includes(scope)) return res.status(400).json({ error: `scope must be one of ${SCOPES.join(', ')}` });
    query.scope = scope;
  }
  const categories = await Category.find(query).sort({ name: 1 });
  res.json({ categories });
});

router.post('/', async (req, res) => {
  const { name, scope } = req.body;
  if (!name || !scope) return res.status(400).json({ error: 'name and scope are required' });
  if (!SCOPES.includes(scope)) return res.status(400).json({ error: `scope must be one of ${SCOPES.join(', ')}` });

  const existing = await Category.findOne({ scope, name: name.trim() });
  if (existing) return res.status(409).json({ error: 'A category with this name already exists' });

  const category = await Category.create({ name: name.trim(), scope, createdBy: req.userId });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'create',
    entityType: 'category',
    entityId: category._id.toString(),
    details: { name: category.name, scope: category.scope },
  });

  res.status(201).json({ category });
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const before = category.name;
  category.name = name.trim();
  await category.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'update',
    entityType: 'category',
    entityId: category._id.toString(),
    details: { before, after: category.name },
  });

  res.json({ category });
});

router.delete('/:id', async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'delete',
    entityType: 'category',
    entityId: category._id.toString(),
    details: { name: category.name, scope: category.scope },
  });

  // Wishlist folders cascade-delete their items (unlike expense/event categories,
  // which just stop being selectable — a folder with no items doesn't make sense).
  if (category.scope === 'wishlist') {
    await WishlistItem.deleteMany({ category: category._id });
  }

  await category.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
