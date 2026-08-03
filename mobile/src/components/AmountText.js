import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { useSettings } from '../context/SettingsContext';

// Privacy mode rendering for money.
//
// Preferred path: React Native's `filter` style (RN 0.76+) applies a real
// Gaussian blur to the view, so the digits are genuinely smeared. It needs no
// native module, which means it ships over OTA. It is however limited to
// Android 12+ (API 31) running the New Architecture — iOS supports only
// brightness/opacity filters, never blur.
//
// Fallback: replace the digits outright. This is what banking apps do, works
// everywhere, and cannot be reversed from a screenshot.
//
// Not used: an earlier attempt drew the glyphs transparent with a blurred text
// shadow. On Android that yields a crisp outline of every digit — the glyph
// interior stays empty — so the number stayed readable at any blur radius.
// Also not used: expo-blur's BlurView, a native module (new APK) that Expo
// documents as experimental on Android with a performance warning.

// `nativeFabricUIManager` is only installed on the global object when Fabric
// is actually running, so this is a fact about the running app rather than an
// assumption about how it was built. If it is missing we fall back to masking,
// which fails safe: the amounts stay hidden either way.
const HAS_FABRIC = typeof global !== 'undefined' && global.nativeFabricUIManager != null;
export const CAN_BLUR = Platform.OS === 'android' && Number(Platform.Version) >= 31 && HAS_FABRIC;

const BLUR_RATIO = 0.4;
const MIN_BLUR_RADIUS = 5;

// Fixed width regardless of the real value: matching the digit count would
// leak the order of magnitude, which is most of what we are hiding.
export const MASK = '•••••';

// Replaces each run of digits (with its thousands/decimal separators) while
// leaving currency symbols, signs and separators intact:
//   "178,670 RSD"       -> "••••• RSD"
//   "$1,200.00"         -> "$•••••"
//   "1.200 RSD · 5 EUR" -> "••••• RSD · ••••• EUR"
export function maskAmounts(text) {
  return String(text).replace(/\d[\d.,]*\d|\d/g, MASK);
}

function blurStyle(style) {
  const flat = StyleSheet.flatten(style) || {};
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
  return { filter: `blur(${Math.max(MIN_BLUR_RADIUS, Math.round(fontSize * BLUR_RATIO))}px)` };
}

function render(text, hideAmounts, style, rest) {
  if (!hideAmounts) {
    return (
      <Text {...rest} style={style}>
        {text}
      </Text>
    );
  }
  if (CAN_BLUR) {
    return (
      <Text {...rest} style={[style, blurStyle(style)]}>
        {text}
      </Text>
    );
  }
  return (
    <Text {...rest} style={style}>
      {maskAmounts(text)}
    </Text>
  );
}

// For already-formatted money strings (chart labels, joined totals).
export function BlurredText({ style, children, ...rest }) {
  const { hideAmounts } = useSettings();
  return render(React.Children.toArray(children).join(''), hideAmounts, style, rest);
}

// For raw values. `prefix`/`suffix` cover call sites like "+1.200 RSD".
export default function Money({ value, currency, prefix, suffix, style, ...rest }) {
  const { formatAmount, hideAmounts } = useSettings();
  const text = `${prefix || ''}${formatAmount(value, currency)}${suffix || ''}`;
  return render(text, hideAmounts, style, rest);
}
