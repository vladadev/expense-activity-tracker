import fs from 'fs';
import path from 'path';
import { translations } from '../src/i18n/translations';

// A missing translation does not crash: t() falls back to returning the key,
// so the app cheerfully shows "toast.folderCreated" to the user. That is
// exactly the kind of defect that ships unnoticed, which is why it is checked
// here rather than hoped for.
const SRC = path.join(__dirname, '..', 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function keysUsedIn(source) {
  // Comments mention keys as examples — including the translation file's own
  // header — and an example is not a call site.
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
  const keys = new Set();
  for (const m of code.matchAll(/(?<![A-Za-z0-9_.])t\('([a-zA-Z][\w.]*)'/g)) keys.add(m[1]);
  return keys;
}

// Keys assembled at runtime from a variable, which a static scan cannot see.
const DYNAMIC_KEYS = [
  'finance.filter.expense', 'finance.filter.income', 'finance.filter.all',
  'notif.expense.create', 'notif.expense.update', 'notif.expense.delete',
  'notif.event.create', 'notif.event.update', 'notif.event.delete',
  'notif.savings.create', 'notif.savings.update', 'notif.savings.delete',
  'notif.income.create', 'notif.income.update', 'notif.income.delete',
  'notif.wishlistItem.create', 'notif.wishlistItem.update', 'notif.wishlistItem.delete',
];

describe('translations', () => {
  it('has the same set of keys in every language', () => {
    const onlyEn = Object.keys(translations.en).filter((k) => !translations.sr[k]).sort();
    const onlySr = Object.keys(translations.sr).filter((k) => !translations.en[k]).sort();
    expect({ missingFromSerbian: onlyEn, missingFromEnglish: onlySr }).toEqual({
      missingFromSerbian: [],
      missingFromEnglish: [],
    });
  });

  it('defines every key the app actually asks for', () => {
    const used = new Set(DYNAMIC_KEYS);
    for (const file of walk(SRC)) {
      for (const key of keysUsedIn(fs.readFileSync(file, 'utf8'))) used.add(key);
    }
    const missing = [...used].filter((k) => !translations.en[k] || !translations.sr[k]).sort();
    expect(missing).toEqual([]);
  });

  it('has no blank values', () => {
    const blank = [];
    for (const lang of ['en', 'sr']) {
      for (const [key, value] of Object.entries(translations[lang])) {
        if (typeof value !== 'string' || !value.trim()) blank.push(`${lang}.${key}`);
      }
    }
    expect(blank).toEqual([]);
  });

  // A placeholder present in one language and absent in the other means that
  // language silently drops the number or name it was meant to show.
  it('uses the same placeholders in both languages', () => {
    const placeholders = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
    const mismatched = Object.keys(translations.en)
      .filter((k) => translations.sr[k] && placeholders(translations.en[k]) !== placeholders(translations.sr[k]))
      .map((k) => `${k}: en(${placeholders(translations.en[k])}) sr(${placeholders(translations.sr[k])})`);
    expect(mismatched).toEqual([]);
  });
});
