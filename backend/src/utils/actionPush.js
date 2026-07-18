const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Same allowlist as the in-app bell feed — money/planning entities only,
// no logins or category housekeeping.
const NOTIFIABLE_ENTITIES = ['expense', 'event', 'savings', 'income', 'wishlistItem'];
// Keep undelivered pushes queued by FCM for up to 4 weeks, so a phone that
// was offline gets everything the moment it reconnects (WhatsApp-style).
const PUSH_TTL_SECONDS = 2419200;
// List check-offs are batched: wait this long after the LAST toggle, then
// send one aggregated push instead of one per grocery item.
const TOGGLE_FLUSH_MS = 5 * 60 * 1000;

// userId -> { userName, checkedTitles: [], uncheckedTitles: [], timer }
const pendingToggles = new Map();

function formatAmount(amount, currency) {
  if (amount == null) return '';
  let formatted;
  try {
    formatted = Number(amount).toLocaleString('sr-RS');
  } catch (e) {
    formatted = String(amount);
  }
  return currency ? `${formatted} ${currency}` : formatted;
}

function itemsWord(n) {
  if (n === 1) return 'stavka';
  if (n >= 2 && n <= 4) return 'stavke';
  return 'stavki';
}

async function sendToOthers(userId, title, body) {
  const recipients = await User.find({ _id: { $ne: userId }, expoPushToken: { $nin: [null, ''] } }).select(
    'expoPushToken'
  );
  await Promise.all(
    recipients.map((r) =>
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: r.expoPushToken,
          title,
          body: body || undefined,
          sound: 'default',
          priority: 'high',
          ttl: PUSH_TTL_SECONDS,
        }),
      })
    )
  );
}

function isPurchaseFlip(action, entityType, details) {
  return (
    entityType === 'wishlistItem' &&
    action === 'update' &&
    details &&
    details.before &&
    details.after &&
    details.before.purchased !== details.after.purchased
  );
}

function queueToggle({ userId, userName, details }) {
  const key = String(userId);
  let pending = pendingToggles.get(key);
  if (!pending) {
    pending = { userName, checkedTitles: [], uncheckedTitles: [], timer: null };
    pendingToggles.set(key, pending);
  }
  const title = details.after.title || '?';
  if (details.after.purchased) pending.checkedTitles.push(title);
  else pending.uncheckedTitles.push(title);

  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => {
    flushToggles(key).catch((err) => console.error('Failed to flush toggle push:', err.message));
  }, TOGGLE_FLUSH_MS);
}

async function flushToggles(key) {
  const pending = pendingToggles.get(key);
  pendingToggles.delete(key);
  if (!pending) return;

  const parts = [];
  if (pending.checkedTitles.length > 0) {
    parts.push(`Čekirano ${pending.checkedTitles.length} ${itemsWord(pending.checkedTitles.length)} ✓`);
  }
  if (pending.uncheckedTitles.length > 0) {
    parts.push(`Vraćeno ${pending.uncheckedTitles.length} ${itemsWord(pending.uncheckedTitles.length)}`);
  }
  if (parts.length === 0) return;

  const names = [...pending.checkedTitles, ...pending.uncheckedTitles];
  const body = names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : '');
  await sendToOthers(key, `${pending.userName} · ${parts.join(' · ')}`, body);
}

// Serbian copy — both household accounts run the app in Serbian.
function buildMessage(action, entityType, details = {}) {
  const d = action === 'update' && details.after ? details.after : details;
  switch (entityType) {
    case 'expense': {
      const titles = { create: 'Novi trošak', update: 'Izmenjen trošak', delete: 'Obrisan trošak' };
      const parts = [formatAmount(d.amount, d.currency), d.category].filter(Boolean).join(' · ');
      return { title: titles[action], body: d.description ? `${parts} (${d.description})` : parts };
    }
    case 'event': {
      const titles = { create: 'Nova aktivnost', update: 'Izmenjena aktivnost', delete: 'Obrisana aktivnost' };
      return { title: titles[action], body: d.title || '' };
    }
    case 'savings': {
      const titles = { create: 'Nova štednja', update: 'Izmenjena štednja', delete: 'Obrisana štednja' };
      const direction = d.direction === 'withdrawal' ? 'Podizanje' : 'Ulog';
      const body = [`${direction}: ${formatAmount(d.amount, d.currency)}`, d.description].filter(Boolean).join(' · ');
      return { title: titles[action], body };
    }
    case 'income': {
      const titles = { create: 'Novi prihod', update: 'Izmenjen prihod', delete: 'Obrisan prihod' };
      const body = [formatAmount(d.amount, d.currency), d.description].filter(Boolean).join(' · ');
      return { title: titles[action], body };
    }
    case 'wishlistItem': {
      const titles = { create: 'Nova stavka na listi', update: 'Izmenjena stavka na listi', delete: 'Obrisana stavka sa liste' };
      const body = [d.title, d.folder].filter(Boolean).join(' · ');
      return { title: titles[action], body };
    }
    default:
      return null;
  }
}

// Mirror of the in-app bell feed as real phone notifications: whatever one
// household member does, the OTHER member's phone gets pinged. The actor
// never gets a push for their own action. Check-off toggles are debounced
// into one aggregated push; everything else goes out immediately.
async function pushActionToPartner({ userId, userName, action, entityType, details }) {
  if (!NOTIFIABLE_ENTITIES.includes(entityType)) return;

  if (isPurchaseFlip(action, entityType, details)) {
    queueToggle({ userId, userName, details });
    return;
  }

  const message = buildMessage(action, entityType, details);
  if (!message || !message.title) return;
  await sendToOthers(userId, `${userName} · ${message.title}`, message.body);
}

module.exports = { pushActionToPartner };
