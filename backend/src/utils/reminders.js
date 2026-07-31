const cron = require('node-cron');
const Event = require('../models/Event');
const WishlistItem = require('../models/WishlistItem');
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Keep undelivered reminders queued by FCM for up to 4 weeks so a phone that
// was offline still gets them once it reconnects.
const PUSH_TTL_SECONDS = 2419200;

async function sendExpoPush(token, title, body) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      ttl: PUSH_TTL_SECONDS,
    }),
  });
}

// Runs every minute, checks for due reminders that haven't been sent yet.
async function checkReminders() {
  const now = new Date();
  const dueFilter = { reminderEnabled: true, reminderSent: false, reminderAt: { $lte: now } };
  const [dueEvents, dueTasks] = await Promise.all([
    Event.find(dueFilter),
    WishlistItem.find({ ...dueFilter, purchased: false }),
  ]);

  const due = [
    ...dueEvents.map((doc) => ({ doc, title: doc.title, body: doc.notes || 'Podsetnik' })),
    // A task's reminder is only useful while it's still open; checked-off
    // items are excluded by the query above.
    ...dueTasks.map((doc) => ({ doc, title: `📋 ${doc.title}`, body: doc.notes || 'Podsetnik za zadatak' })),
  ];
  if (due.length === 0) return;

  // Tokens grouped BY HOUSEHOLD. Reminders are shared within a household, but
  // must never cross between them — sending to every registered device would
  // push one couple's plans onto a stranger's phone.
  const householdIds = [...new Set(due.map(({ doc }) => String(doc.household)).filter(Boolean))];
  const users = await User.find({
    household: { $in: householdIds },
    expoPushToken: { $nin: [null, ''] },
  }).select('household expoPushToken');

  const tokensByHousehold = {};
  for (const u of users) {
    const key = String(u.household);
    if (!tokensByHousehold[key]) tokensByHousehold[key] = [];
    tokensByHousehold[key].push(u.expoPushToken);
  }

  for (const { doc, title, body } of due) {
    const tokens = tokensByHousehold[String(doc.household)] || [];
    if (tokens.length === 0) {
      // Nobody in that household has a push token yet — leave reminderSent
      // false so it's retried automatically once a device registers, instead
      // of silently marking a reminder "sent" that was never delivered.
      console.log(`Skipping reminder for ${doc._id} — no registered push tokens in its household`);
      continue;
    }
    let delivered = 0;
    for (const token of tokens) {
      try {
        await sendExpoPush(token, title, body);
        delivered++;
      } catch (err) {
        console.error(`Failed to send push for ${doc._id}:`, err.message);
      }
    }
    if (delivered === 0) continue;
    doc.reminderSent = true;
    await doc.save();
  }
}

function startReminderCron() {
  cron.schedule('* * * * *', () => {
    checkReminders().catch((err) => console.error('Reminder check failed:', err));
  });
  console.log('Reminder cron job started (runs every minute)');
}

module.exports = { startReminderCron, checkReminders };
