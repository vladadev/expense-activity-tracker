const cron = require('node-cron');
const Event = require('../models/Event');
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(token, title, body) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default' }),
  });
}

// Runs every minute, checks for due reminders that haven't been sent yet.
async function checkReminders() {
  const now = new Date();
  const dueEvents = await Event.find({
    reminderEnabled: true,
    reminderSent: false,
    reminderAt: { $lte: now },
  });
  if (dueEvents.length === 0) return;

  // Reminders are a shared household feature — every registered device gets
  // every reminder, regardless of who created the event.
  const users = await User.find({ expoPushToken: { $nin: [null, ''] } }).select('name expoPushToken');
  const tokens = users.map((u) => u.expoPushToken);

  for (const event of dueEvents) {
    if (tokens.length === 0) {
      // Nobody has a push token yet — leave reminderSent false so it's
      // retried automatically once a device registers, instead of silently
      // marking a reminder "sent" that was never delivered.
      console.log(`Skipping reminder for event ${event._id} — no registered push tokens`);
      continue;
    }
    let delivered = 0;
    for (const token of tokens) {
      try {
        await sendExpoPush(token, event.title, event.notes || 'Reminder');
        delivered++;
      } catch (err) {
        console.error(`Failed to send push for event ${event._id}:`, err.message);
      }
    }
    if (delivered === 0) continue;
    event.reminderSent = true;
    await event.save();
  }
}

function startReminderCron() {
  cron.schedule('* * * * *', () => {
    checkReminders().catch((err) => console.error('Reminder check failed:', err));
  });
  console.log('Reminder cron job started (runs every minute)');
}

module.exports = { startReminderCron, checkReminders };
