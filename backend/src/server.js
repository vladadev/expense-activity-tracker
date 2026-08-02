require('dotenv').config();
// Must run before the app and its dependencies are loaded, so Sentry can
// instrument express/mongo as they are required.
const { initSentry, Sentry } = require('./config/sentry');
initSentry();

const app = require('./app');
const connectDB = require('./config/db');
const { startReminderCron } = require('./utils/reminders');

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  startReminderCron();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Without these, an error thrown outside a request handler (a failed cron run,
// a rejected promise in a fire-and-forget push) would kill or silently degrade
// the process with nothing recorded anywhere.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  Sentry.captureException(err);
  // Give Sentry a moment to deliver before the process dies.
  Sentry.flush(2000).finally(() => process.exit(1));
});
