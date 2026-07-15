const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const eventRoutes = require('./routes/events');
const statsRoutes = require('./routes/stats');
const pushTokenRoutes = require('./routes/pushToken');
const auditLogRoutes = require('./routes/auditLog');
const categoryRoutes = require('./routes/categories');
const savingsRoutes = require('./routes/savings');
const wishlistRoutes = require('./routes/wishlist');
const incomeRoutes = require('./routes/income');
const notificationRoutes = require('./routes/notifications');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/push-token', pushTokenRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
