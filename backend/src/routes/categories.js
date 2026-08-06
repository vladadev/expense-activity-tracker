const express = require('express');
const Category = require('../models/Category');
const WishlistItem = require('../models/WishlistItem');
const requireAuth = require('../middleware/auth');
const { requireHousehold } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const SCOPES = ['expense', 'event', 'wishlist', 'todo'];
// Scopes whose folders behave like checkable lists (nesting + cascade delete).
const LIST_SCOPES = ['wishlist', 'todo'];

// Folders nest at most two levels (a folder and its subfolders), so this walks
// a shallow tree — but it is written breadth-first anyway, because a bug that
// leaves a deeper chain behind should not turn into an infinite loop here.
async function collectDescendants(householdId, rootId) {
  const found = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await Category.find({ household: householdId, parent: { $in: frontier } }).select('_id');
    frontier = children.map((c) => c._id);
    found.push(...frontier);
  }
  return found;
}

const router = express.Router();
router.use(requireAuth);
router.use(requireHousehold);

// GET /api/categories?scope=expense — shared household view, all categories visible to both users.
router.get('/', async (req, res) => {
  const { scope } = req.query;
  const query = { household: req.householdId };
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
  await Promise.all(ids.map((id, index) => Category.updateOne({ _id: id, household: req.householdId }, { order: index })));
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
    const parentFolder = await Category.findOne({ _id: parent, scope, household: req.householdId });
    if (!parentFolder) return res.status(400).json({ error: 'Unknown parent folder' });
    if (parentFolder.parent) return res.status(400).json({ error: 'Folders can only nest two levels deep' });
    parentId = parentFolder._id;
  }

  const existing = await Category.findOne({ household: req.householdId, scope, parent: parentId, name: name.trim() });
  if (existing) return res.status(409).json({ error: 'A category with this name already exists' });

  // New folders go to the end of their sibling group.
  const lastSibling = await Category.findOne({ household: req.householdId, scope, parent: parentId }).sort({ order: -1 }).select('order');
  const category = await Category.create({
    household: req.householdId,
    name: name.trim(),
    scope,
    parent: parentId,
    order: (lastSibling?.order ?? -1) + 1,
    createdBy: req.userId,
  });

  logAction({
    userId: req.userId,
    userName: req.userName,
    householdId: req.householdId,
    action: 'create',
    entityType: 'category',
    entityId: category._id.toString(),
    details: { name: category.name, scope: category.scope },
  });

  res.status(201).json({ category });
});

// Rename and/or move. `parent` is only meaningful for list scopes; pass null
// to move a subfolder back out to the root.
router.put('/:id', async (req, res) => {
  const { name, parent } = req.body;
  const movingParent = Object.prototype.hasOwnProperty.call(req.body, 'parent');
  if (name === undefined && !movingParent) {
    return res.status(400).json({ error: 'name or parent is required' });
  }
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const category = await Category.findOne({ _id: req.params.id, household: req.householdId });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const before = { name: category.name, parent: category.parent };
  let parentId = category.parent;

  if (movingParent) {
    if (!LIST_SCOPES.includes(category.scope)) {
      return res.status(400).json({ error: 'Only list folders can be moved' });
    }
    if (parent == null) {
      parentId = null;
    } else {
      if (String(parent) === String(category._id)) {
        return res.status(400).json({ error: 'A folder cannot be moved into itself' });
      }
      const parentFolder = await Category.findOne({
        _id: parent,
        scope: category.scope,
        household: req.householdId,
      });
      if (!parentFolder) return res.status(400).json({ error: 'Unknown parent folder' });

      // Without this a folder could be moved under its own descendant, which
      // detaches that whole branch from the tree — it would still exist in the
      // database but be unreachable from any root, with no way to get it back.
      const descendants = await collectDescendants(req.householdId, category._id);
      if (descendants.some((id) => String(id) === String(parentFolder._id))) {
        return res.status(400).json({ error: 'A folder cannot be moved into its own subfolder' });
      }
      if (parentFolder.parent) {
        return res.status(400).json({ error: 'Folders can only nest two levels deep' });
      }
      // Moving a folder that has children under another folder would put those
      // children at the third level.
      const hasChildren = await Category.exists({ household: req.householdId, parent: category._id });
      if (hasChildren) {
        return res.status(400).json({ error: 'A folder with subfolders cannot become a subfolder' });
      }
      parentId = parentFolder._id;
    }
  }

  const nextName = name !== undefined ? String(name).trim() : category.name;
  const clash = await Category.findOne({
    _id: { $ne: category._id },
    household: req.householdId,
    scope: category.scope,
    parent: parentId,
    name: nextName,
  });
  if (clash) return res.status(409).json({ error: 'A category with this name already exists' });

  category.name = nextName;
  if (movingParent && String(parentId) !== String(category.parent)) {
    category.parent = parentId;
    const lastSibling = await Category.findOne({ household: req.householdId, scope: category.scope, parent: parentId })
      .sort({ order: -1 })
      .select('order');
    category.order = (lastSibling?.order ?? -1) + 1;
  }
  await category.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    householdId: req.householdId,
    action: 'update',
    entityType: 'category',
    entityId: category._id.toString(),
    details: { before: before.name, after: category.name, moved: movingParent || undefined },
  });

  res.json({ category });
});

router.delete('/:id', async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, household: req.householdId });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    householdId: req.householdId,
    action: 'delete',
    entityType: 'category',
    entityId: category._id.toString(),
    details: { name: category.name, scope: category.scope },
  });

  // List folders (wishlist/todo) cascade-delete their items and subfolders
  // recursively (unlike expense/event categories, which just stop being selectable).
  if (LIST_SCOPES.includes(category.scope)) {
    const toDelete = [category._id, ...(await collectDescendants(req.householdId, category._id))];
    await WishlistItem.deleteMany({ category: { $in: toDelete } });
    await Category.deleteMany({ _id: { $in: toDelete } });
    return res.json({ ok: true });
  }

  await category.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
