// The household every request is made in.
//
// A module-level value rather than React state, because the two things that
// need it are not components: the axios request interceptor and the read
// cache. They cannot read a context, and this value does not decide what gets
// drawn — HouseholdContext owns that, and keeps this in step with it.
//
// It is the opposite call from person colours, where a module variable would
// have been wrong precisely because it does decide what gets drawn.

let activeHouseholdId = null;

export function setActiveHouseholdId(id) {
  activeHouseholdId = id ? String(id) : null;
}

export function getActiveHouseholdId() {
  return activeHouseholdId;
}

export const HOUSEHOLD_HEADER = 'X-Household-Id';
