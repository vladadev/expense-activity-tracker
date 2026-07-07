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
  }).populate('owner');

  for (const event of dueEvents) {
    const token = event.owner?.expoPushToken;
    if (token) {
      try {
        await sendExpoPush(token, event.title, event.notes || 'Reminder');
      } catch (err) {
        console.error(`Failed to send push for event ${event._id}:`, err.message);
        continue;
      }
    }
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
