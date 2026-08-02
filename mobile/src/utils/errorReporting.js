// Crash and error reporting for the app.
//
// @sentry/react-native is a NATIVE module: it only exists inside an APK built
// after it was added. An over-the-air update that imported it directly would
// crash instantly on every phone still running the older binary. So the import
// is lazy and guarded — if the native side isn't there, reporting quietly
// switches off and the app behaves exactly as before.
//
// PRIVACY: this app holds salaries and spending. Nothing carrying financial or
// personal detail is sent — only the error, where it happened, and the app
// version.

let Sentry = null;
let enabled = false;

const SENSITIVE_KEYS = [
  'password', 'token', 'authorization', 'jwt', 'secret', 'expopushtoken',
  'amount', 'price', 'description', 'notes', 'title', 'email', 'name',
];

function scrub(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.includes(key.toLowerCase()) ? '[redacted]' : scrub(val, depth + 1);
  }
  return out;
}

export function initErrorReporting(dsn) {
  if (!dsn) return false;
  try {
    // eslint-disable-next-line global-require
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      // Breadcrumbs record what the user did before a crash. Console output
      // and network payloads are excluded — both routinely contain amounts.
      maxBreadcrumbs: 30,
      beforeBreadcrumb(crumb) {
        if (crumb.category === 'console') return null;
        if (crumb.data) crumb.data = scrub(crumb.data);
        return crumb;
      },
      beforeSend(event) {
        if (event.request) delete event.request.data;
        if (event.extra) event.extra = scrub(event.extra);
        if (event.contexts) event.contexts = scrub(event.contexts);
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
    });
    enabled = true;
    return true;
  } catch (err) {
    // Older binary without the native module, or init failed. Reporting is a
    // diagnostic aid — it must never be the reason the app won't start.
    console.log('Error reporting unavailable:', err.message);
    Sentry = null;
    enabled = false;
    return false;
  }
}

// Ties an error to an account without revealing who it is. The household id
// makes it possible to tell "one couple hit this 40 times" apart from "40
// different couples hit it once".
export function identifyUser(user) {
  if (!enabled || !Sentry || !user) return;
  try {
    Sentry.setUser({ id: String(user.id) });
    if (user.household) Sentry.setTag('household', String(user.household));
  } catch {
    // Never let telemetry break a login.
  }
}

export function clearUser() {
  if (!enabled || !Sentry) return;
  try {
    Sentry.setUser(null);
  } catch {
    // Ignore.
  }
}

// For failures the app handles itself but that still shouldn't go unnoticed —
// a save that silently failed, a background refresh that never completed.
export function reportError(error, context) {
  if (!enabled || !Sentry) return;
  try {
    Sentry.captureException(error, context ? { tags: scrub(context) } : undefined);
  } catch {
    // Ignore.
  }
}

export function isErrorReportingEnabled() {
  return enabled;
}
