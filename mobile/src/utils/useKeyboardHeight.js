import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Height of the on-screen keyboard, or 0 when it is closed.
//
// Expo SDK 54 enforces edge-to-edge on Android, which breaks both
// KeyboardAvoidingView and the native windowSoftInputMode=resize setting: the
// root view no longer actually resizes when the keyboard opens, so there is
// nothing to "avoid" into. Reading the real keyboardDidShow height and padding
// by hand is what works.
//
// Modals need this separately from the rest of the app — they render in their
// own native window, so padding applied by the screen underneath does not
// reach them.
export default function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}
