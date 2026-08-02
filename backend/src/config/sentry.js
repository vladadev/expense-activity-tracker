const Sentry = require('@sentry/node');

// Error reporting for the API. Without this, a 500 on Render is a line in a
// log nobody reads; with it, the failure arrives with a stack trace and the
// request that caused it.
//
// PRIVACY: this app handles salaries, spending and passwords. Sentry is a
// third-party service, so everything that could carry personal or financial
// detail is stripped before an event leaves the process. What gets sent is
// the error, the stack, and the route — never the payload.

// Field names whose values must never be transmitted, matched case-insensitively.
const SENSITIVE_KEYS = [
  'password', 'passwordhash', 'token', 'authorization', 'cookie',
  'jwt', 'secret', 'expopushtoken', 'mongodb_uri', 'passphrase',
  // Financial and free-text fields — none of these help debugging.
  'amount', 'price', 'description', 'notes', 'title', 'email', 'name',
];

function scrub(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else {
      out[key] = scrub(val, depth + 1);
    }
  }
  return out;
}

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Deliberately silent-but-visible: the app must run perfectly well
    // without error reporting configured.
    console.log('Sentry: not configured (SENTRY_DSN unset) — error reporting disabled');
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    // Sample a slice of requests for performance data; errors are always sent.
    tracesSampleRate: 0.1,
    // Never let Sentry attach IPs, cookies or user identities automatically.
    sendDefaultPii: false,
    beforeSend(event) {
      // Request bodies and query strings can hold passwords and amounts.
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) event.request.headers = scrub(event.request.headers);
        if (event.request.query_string) event.request.query_string = '[redacted]';
      }
      if (event.extra) event.extra = scrub(event.extra);
      if (event.contexts) event.contexts = scrub(event.contexts);
      // Keep only an opaque user id — never name or email.
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });

  console.log(`Sentry: error reporting enabled (${process.env.NODE_ENV || 'production'})`);
  return true;
}

module.exports = { initSentry, Sentry, scrub };
