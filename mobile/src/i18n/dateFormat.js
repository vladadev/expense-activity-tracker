// Hermes (React Native's JS engine) often lacks full ICU locale data, so
// toLocaleDateString('sr-RS', ...) silently falls back to English on-device
// even though it works fine in a browser/dev environment. Format manually
// instead of trusting Intl for locales outside en-US.
const DAY_NAMES = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  sr: ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'],
};

const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  sr: ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'],
};

// e.g. "Wednesday, July 1, 2026" (en) / "Sreda, 1. jul 2026." (sr)
export function formatLongDate(dateString, language) {
  const d = new Date(dateString + 'T00:00:00');
  const day = DAY_NAMES[language]?.[d.getDay()] ?? DAY_NAMES.en[d.getDay()];
  const month = MONTH_NAMES[language]?.[d.getMonth()] ?? MONTH_NAMES.en[d.getMonth()];
  const date = d.getDate();
  const year = d.getFullYear();

  if (language === 'sr') {
    return `${day}, ${date}. ${month} ${year}.`;
  }
  return `${day}, ${month} ${date}, ${year}`;
}

// e.g. "July 2026" (en) / "Jul 2026." (sr) — used for month navigation headings.
export function formatMonthYear(date, language) {
  const month = MONTH_NAMES[language]?.[date.getMonth()] ?? MONTH_NAMES.en[date.getMonth()];
  const year = date.getFullYear();
  return language === 'sr' ? `${month} ${year}.` : `${month} ${year}`;
}

// e.g. "19:00" — used where the date is already implied by context (a day's
// activity list) and only the time-of-day is useful.
export function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// e.g. "Jul 1, 14:30" (en) / "1. jul, 14:30" (sr) — used for shorter timestamps
export function formatShortDateTime(date, language) {
  const month = MONTH_NAMES[language]?.[date.getMonth()] ?? MONTH_NAMES.en[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (language === 'sr') {
    return `${date.getDate()}. ${month}, ${hours}:${minutes}`;
  }
  return `${month} ${date.getDate()}, ${hours}:${minutes}`;
}
