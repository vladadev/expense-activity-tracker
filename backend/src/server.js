require('dotenv').config();
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
