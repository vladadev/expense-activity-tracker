const express = require('express');
const Event = require('../models/Event');
const Category = require('../models/Category');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

async function categoryExists(name) {
  return Category.exists({ scope: 'event', name });
}

// Shared household view — both users see all events (plans, birthdays, reminders).
router.get('/', async (req, res) => {
  const { date, from, to } = req.query;
  const query = {};

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    query.date = { $gte: start, $lt: end };
  } else if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const events = await Event.find(query).populate('owner', 'name').sort({ date: 1 });
  res.json({ events });
});

router.get('/:id', async (req, res) => {
  const event = await Event.findById(req.params.id).populate('owner', 'name');
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ event });
});

router.post('/', async (req, res) => {
  const { title, type, notes, date, reminderEnabled, reminderAt } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'title and type are required' });
  }
  if (!(await categoryExists(type))) {
    return res.status(400).json({ error: `Unknown category: ${type}` });
  }

  const event = await Event.create({
    owner: req.userId,
    date: date ? new Date(date) : new Date(),
    type,
    title,
    notes: notes || '',
    reminderEnabled: !!reminderEnabled,
    reminderAt: reminderAt ? new Date(reminderAt) : null,
  });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'create',
    entityType: 'event',
    entityId: event._id.toString(),
    details: { title: event.title, type: event.type },
  });

  res.status(201).json({ event });
});

router.put('/:id', async (req, res) => {
  const { title, type, notes, date, reminderEnabled, reminderAt } = req.body;
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const before = { title: event.title, type: event.type, notes: event.notes, date: event.date };

  if (title) event.title = title;
  if (type) {
    if (!(await categoryExists(type))) {
      return res.status(400).json({ error: `Unknown category: ${type}` });
    }
    event.type = type;
  }
  if (notes != null) event.notes = notes;
  if (date) event.date = new Date(date);
  if (reminderEnabled != null) event.reminderEnabled = reminderEnabled;
  if (reminderAt !== undefined) {
    event.reminderAt = reminderAt ? new Date(reminderAt) : null;
    event.reminderSent = false; // reset so a changed reminder time fires again
  }

  await event.save();

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'update',
    entityType: 'event',
    entityId: event._id.toString(),
    details: { before, after: { title: event.title, type: event.type, notes: event.notes, date: event.date } },
  });

  res.json({ event });
});

router.delete('/:id', async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  logAction({
    userId: req.userId,
    userName: req.userName,
    action: 'delete',
    entityType: 'event',
    entityId: event._id.toString(),
    details: { title: event.title, type: event.type },
  });

  await event.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
