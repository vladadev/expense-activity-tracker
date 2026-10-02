import Constants from 'expo-constants';

// Which of the two builds this is.
//
// The redesign lives in the same codebase as the app two people use every day,
// and the two must never be confused. A separate Android package installs the
// design build beside the real one and it listens to its own update channel,
// but that only keeps the BUILDS apart — this keeps the CODE apart, so main
// stays shippable at every moment and an unrelated fix sent to the real app
// cannot carry half a redesign with it.
export const IS_DESIGN = Constants.expoConfig?.extra?.variant === 'design';
