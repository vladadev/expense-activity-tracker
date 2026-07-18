const express = require('express');
const Category = require('../models/Category');
const WishlistItem = require('../models/WishlistItem');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const SCOPES = ['expense', 'event', 'wishlist', 'todo'];
// Scopes whose folders behave like checkable lists (nesting + cascade delete).
const LIST_SCOPES = ['wishlist', 'todo'];

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
  const categories = await Category.find(query).sort({ order: 1, name: 1 });
  res.json({ categories });
});

// PUT /reorder — bulk-persist a manual folder order. Registered before /:id
// so "reorder" isn't parsed as a category id.
router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  await Promise.all(ids.map((id, index) => Category.updateOne({ _id: id }, { order: index })));
  res.json({ ok: true });
});

router.post('/', async (req, res) => {
  const { name, scope, parent } = req.body;
  if (!name || !scope) return res.status(400).json({ error: 'name and scope are required' });
  if (!SCOPES.includes(scope)) return res.status(400).json({ error: `scope must be one of ${SCOPES.join(', ')}` });

  // Subfolders exist only for list-type scopes (wishlist/todo).
  let parentId = null;
  if (parent) {
    if (!LIST_SCOPES.includes(scope)) return res.status(400).json({ error: 'Only list folders can have a parent' });
    const parentFolder = await Category.findOne({ _id: parent, scope });
    if (!parentFolder) return res.status(400).json({ error: 'Unknown parent folder' });
    parentId = parentFolder._id;
  }

  const existing = await Category.findOne({ scope, parent: parentId, name: name.trim() });
  if (existing) return res.status(409).json({ error: 'A category with this name already exists' });

  // New folders go to the end of their sibling group.
  const lastSibling = await Category.findOne({ scope, parent: parentId }).sort({ order: -1 }).select('order');
  const category = await Category.create({
    name: name.trim(),
    scope,
    parent: parentId,
    order: (lastSibling?.order ?? -1) + 1,
    createdBy: req.userId,
  });

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

  // List folders (wishlist/todo) cascade-delete their items and subfolders
  // recursively (unlike expense/event categories, which just stop being selectable).
  if (LIST_SCOPES.includes(category.scope)) {
    const toDelete = [category._id];
    let frontier = [category._id];
    while (frontier.length > 0) {
      const children = await Category.find({ parent: { $in: frontier } }).select('_id');
      frontier = children.map((c) => c._id);
      toDelete.push(...frontier);
    }
    await WishlistItem.deleteMany({ category: { $in: toDelete } });
    await Category.deleteMany({ _id: { $in: toDelete } });
    return res.json({ ok: true });
  }

  await category.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
