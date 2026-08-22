// Text matching for the transactions search.
//
// Both the query and the searched text are folded to plain ASCII letters
// before comparing, so typing without diacritics finds text that has them
// (and the other way round): "secer" and "šećer" both fold to "secer".
//
// This is not a Serbian-only concern — the same folding makes "cafe" match
// "café", so it works whatever language the app is set to.

// NFD splits an accented letter into base + combining mark, which the regex
// then strips. Đ/đ is not decomposable that way (it is its own letter, not a
// D with a mark), so it needs an explicit rule — and because people commonly
// type it as "dj", that digraph is collapsed to "d" as well. The result:
// "đubre", "djubre" and "dubre" all fold to "dubre" and match each other.
const EXPLICIT = { đ: 'd', Đ: 'd', ђ: 'd', Ђ: 'd' };

function fold(value) {
  if (value == null) return '';
  let text = String(value);
  text = text.replace(/[đĐђЂ]/g, (ch) => EXPLICIT[ch] || ch);
  if (typeof text.normalize === 'function') {
    text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  text = text.toLowerCase().replace(/dj/g, 'd');
  // Drop a separator sitting between two digits, on both the query and the
  // searched text, so the thousands separator the user can see ("2.400")
  // matches the raw amount ("2400"). A comma followed by a space, as in
  // "Maxi, nedeljna kupovina", is left alone.
  return text.replace(/(\d)[.,\s](?=\d)/g, '$1').trim();
}

// Every whitespace-separated term must appear somewhere in the record, so
// "maxi kafa" narrows instead of widening. Amounts are matched against the
// raw number ("2400"), never the formatted string, because "2.400 RSD" would
// otherwise fail on the separator the user cannot see they need to type.
export function matches(query, fields) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fields
    .filter((f) => f != null && f !== '')
    .map((f) => fold(f))
    .join(' ');
  return terms.every((term) => haystack.includes(term));
}
