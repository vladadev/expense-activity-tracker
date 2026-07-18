const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Same allowlist as the in-app bell feed — money/planning entities only,
// no logins or category housekeeping.
const NOTIFIABLE_ENTITIES = ['expense', 'event', 'savings', 'income', 'wishlistItem'];

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
      // A purchased-flag flip is the most common list action — give it
      // friendlier wording than a generic "updated item".
      if (action === 'update' && details.before && details.after && details.before.purchased !== details.after.purchased) {
        return details.after.purchased
          ? { title: 'Čekirano na listi ✓', body: details.after.title || '' }
          : { title: 'Vraćeno na listu', body: details.after.title || '' };
      }
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
// never gets a push for their own action.
async function pushActionToPartner({ userId, userName, action, entityType, details }) {
  if (!NOTIFIABLE_ENTITIES.includes(entityType)) return;
  const message = buildMessage(action, entityType, details);
  if (!message || !message.title) return;

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
          title: `${userName} · ${message.title}`,
          body: message.body || undefined,
          sound: 'default',
        }),
      })
    )
  );
}

module.exports = { pushActionToPartner };
