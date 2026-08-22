import { Platform, Vibration } from 'react-native';

// Real haptics where the build has them, a plain buzz where it does not.
//
// expo-haptics is a native module: an OTA update can ship this file but cannot
// add the module to an APK that was built without it. The require is guarded
// and lazy so an older install keeps working — it simply falls back to the
// coarse Vibration API — rather than crashing on a module that is not there.
let haptics = null;
let resolved = false;

function load() {
  if (resolved) return haptics;
  resolved = true;
  try {
    // eslint-disable-next-line global-require
    haptics = require('expo-haptics');
  } catch (err) {
    haptics = null;
  }
  return haptics;
}

function fallback(ms) {
  if (Platform.OS === 'android') Vibration.vibrate(ms);
}

// A confirmation you feel rather than read — used where the eye is already
// somewhere else, like a checkbox under the thumb.
export function tapLight() {
  const h = load();
  if (h) h.impactAsync(h.ImpactFeedbackStyle.Light).catch(() => {});
  else fallback(8);
}

export function notifySuccess() {
  const h = load();
  if (h) h.notificationAsync(h.NotificationFeedbackType.Success).catch(() => {});
  else fallback(10);
}

export function notifyError() {
  const h = load();
  if (h) h.notificationAsync(h.NotificationFeedbackType.Error).catch(() => {});
  else fallback(18);
}
