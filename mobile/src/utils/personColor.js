// A colour per person, so entries can be told apart at a glance.
//
// Deliberately not theme colours: this is about telling people apart, not
// decorating, so it must stay stable when the theme changes.
//
// The colour comes from a person's POSITION in their household — first member
// gets the first colour, second the second, and so on. That guarantees two
// people in the same household never share a colour, which a hash of the name
// cannot promise: with seven colours, two random names collide about one time
// in seven.
//
// Names used to be hardcoded here, which worked for exactly one household.

export const PALETTE = ['#3B82F6', '#DB2777', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
export const NO_PERSON = '#9CA3AF';

function hashIndex(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTE.length;
}

// `order` is the household's member names, in the order they joined. A name
// that is not in it — someone who has since left, or a list that has not
// loaded yet — falls back to a hash, which is stable and readable even if it
// cannot promise uniqueness.
export function colorFor(name, order = []) {
  if (!name) return NO_PERSON;
  const key = String(name).trim().toLowerCase();
  if (!key) return NO_PERSON;
  const position = order.indexOf(key);
  if (position !== -1) return PALETTE[position % PALETTE.length];
  return PALETTE[hashIndex(key)];
}

// Normalises a member list into the form colorFor expects.
export function toColorOrder(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => (typeof m === 'string' ? m : m?.name))
    .filter(Boolean)
    .map((n) => String(n).trim().toLowerCase());
}
