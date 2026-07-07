// These are only used to SEED the initial set of user-editable categories
// (see utils/seedCategories.js) — after that, categories live in the
// Category collection and users can add/rename/delete them freely.
const DEFAULT_EXPENSE_CATEGORIES = ['Hrana', 'Prevoz', 'Računi', 'Kupovina', 'Zabava', 'Zdravlje', 'Ostalo'];
const DEFAULT_EVENT_CATEGORIES = ['Plan', 'Rođendan', 'Podsetnik', 'Ostalo'];

const EXPENSE_TYPES = ['personal', 'together'];

// No live conversion between currencies — each expense is tracked in the
// currency it was actually paid in, and stats show per-currency totals
// side by side rather than one converted number.
const CURRENCIES = ['RSD', 'EUR', 'USD'];
const DEFAULT_CURRENCY = 'RSD';

module.exports = {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EVENT_CATEGORIES,
  EXPENSE_TYPES,
  CURRENCIES,
  DEFAULT_CURRENCY,
};
