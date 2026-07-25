const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

// Render terminates TLS in front of the app; without this the rate limiter
// sees every request as coming from the proxy's IP instead of the client's.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
// Cap request bodies — nothing this API accepts is anywhere near this size,
// and an unbounded limit is a free memory-exhaustion vector.
app.use(express.json({ limit: '100kb' }));

// Brute-force protection on login. Everything else sits behind a JWT, so the
// login endpoint is the only door an attacker can knock on repeatedly.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Broad ceiling for the authenticated API — generous enough that normal use
// never notices, low enough to blunt a scripted hammering.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down and try again shortly.' },
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
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
  // Client-caused errors get an accurate status and a message the app can
  // show; anything else is logged server-side and reported generically so
  // internals (stack traces, driver errors) never reach the client.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Malformed request body.' });
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid data submitted.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
