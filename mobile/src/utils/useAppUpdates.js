import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { IS_DESIGN } from '../theme/variant';

// Getting a published update onto the phone.
//
// The app had no code for this at all, and Expo's default is to launch the
// bundle it already has and download the new one behind it — which is applied
// on the NEXT cold start. So every session ran one publish behind, and a
// phone that was only ever backgrounded rather than closed could sit several
// behind indefinitely. Days of "I see no improvement" came from that, not from
// the changes, and it is the kind of fault that hides every other fault behind
// it: nothing you ship can be judged if it is not the thing being run.
//
// The design build takes it immediately — the whole point of that build is to
// be the newest thing. The real app fetches and lets the next launch apply it,
// because reloading under somebody who is halfway through typing an expense is
// not a kindness.

const MIN_GAP_MS = 15000;

export default function useAppUpdates() {
  const busy = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Disabled in development, where the bundle comes from Metro.
      if (!Updates.isEnabled || busy.current) return;
      if (Date.now() - lastCheck.current < MIN_GAP_MS) return;
      busy.current = true;
      lastCheck.current = Date.now();
      try {
        const found = await Updates.checkForUpdateAsync();
        if (!found.isAvailable || cancelled) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        if (IS_DESIGN) await Updates.reloadAsync();
      } catch (err) {
        // No connection, or the update server is unreachable. The bundle in
        // hand is a working app; this is not worth telling anyone about.
        console.log('Update check skipped:', err.message);
      } finally {
        busy.current = false;
      }
    }

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}

// The same check, on purpose, from a button. Returns what happened so the
// screen can say it — "you are on the newest one" is an answer, and a button
// that reports nothing is a button you press twice.
export async function checkForUpdateNow() {
  if (!Updates.isEnabled) return { state: 'disabled' };
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return { state: 'current' };
    await Updates.fetchUpdateAsync();
    return { state: 'ready' };
  } catch (err) {
    return { state: 'failed', reason: err.message };
  }
}
