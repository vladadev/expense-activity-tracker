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

  // All-day entries (startTime null) sort above timed ones within the same
  // day, ordered by their manual `order`; timed entries follow by clock time.
  const events = await Event.find(query).populate('owner', 'name').sort({ date: 1, startTime: 1, order: 1 });
  res.json({ events });
});

// PUT /reorder — manual ordering of all-day entries. Registered before /:id
// so "reorder" isn't parsed as an event id.
router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  await Promise.all(ids.map((id, index) => Event.updateOne({ _id: id }, { order: index })));
  res.json({ ok: true });
});

router.get('/:id', async (req, res) => {
  const event = await Event.findById(req.params.id).populate('owner', 'name');
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ event });
});

router.post('/', async (req, res) => {
  const { title, type, notes, date, startTime, reminderEnabled, reminderAt } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'title and type are required' });
  }
  if (!(await categoryExists(type))) {
    return res.status(400).json({ error: `Unknown category: ${type}` });
  }

  // New all-day entries go to the end of that day's all-day group.
  const eventDate = date ? new Date(date) : new Date();
  let order = 0;
  if (!startTime) {
    const dayEnd = new Date(eventDate);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const last = await Event.findOne({ date: { $gte: eventDate, $lt: dayEnd }, startTime: null })
      .sort({ order: -1 })
      .select('order');
    order = (last?.order ?? -1) + 1;
  }

  const event = await Event.create({
    owner: req.userId,
    date: eventDate,
    type,
    title,
    notes: notes || '',
    startTime: startTime || null,
    order,
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
  const { title, type, notes, date, startTime, reminderEnabled, reminderAt } = req.body;
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
  if (startTime !== undefined) event.startTime = startTime || null;
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
