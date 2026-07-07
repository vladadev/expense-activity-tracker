// Assigns a consistent, distinct color to each person's name so entries can
// be recognized at a glance regardless of which of the app's themes is
// active — deliberately NOT theme colors, since this is about telling two
// people apart, not decorating the UI.
//
// The two known household accounts get intentionally picked colors (rather
// than whatever the hash below lands on) — Vladimir stays a classic blue,
// Tijana gets a rose/pink that reads clearly on every theme's background,
// including the Pink theme itself (picked to not blend into that theme's
// own #EC4899 primary accent).
const KNOWN_COLORS = {
  vladimir: '#3B82F6',
  tijana: '#DB2777',
};

const FALLBACK_PALETTE = ['#3B82F6', '#DB2777', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

export function getPersonColor(name) {
  if (!name) return '#9CA3AF';

  const known = KNOWN_COLORS[name.trim().toLowerCase()];
  if (known) return known;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}
