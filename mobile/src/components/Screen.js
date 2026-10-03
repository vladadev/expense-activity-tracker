import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import NotificationBell from './NotificationBell';
import SettingsGear from './SettingsGear';
import PondHorizon from './pond/PondHorizon';
import { ON_WATER, ON_WATER_DIM, useStatusBarOnWater } from './pond/onWater';
import { IS_DESIGN } from '../theme/variant';
import useKeyboardHeight from '../utils/useKeyboardHeight';

// Replaces React Navigation's native stack header everywhere in the app.
// The native header wasn't reserving space for the status bar correctly on
// this device/Android setup (overlapping content on every pushed screen,
// not just stack roots) — this JS-rendered header lives inside the same
// SafeAreaView we already confirmed works, so it can't have that problem.
//
// Keyboard handling on Android is done by hand — see useKeyboardHeight for why
// KeyboardAvoidingView and windowSoftInputMode=resize both stopped working.

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: 4, padding: 4 },
  privacyButton: { padding: 4, marginRight: 4 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
});

// showPrivacyToggle is opt-in: the eye only belongs on screens that actually
// display amounts, otherwise it is a control that appears to do nothing.
//
// showSettings is opt-out, and defaults to "wherever there is no back arrow" —
// that is, the root of a tab. Settings is reachable from every screen you can
// stop on, and does not offer itself from inside the stack it is already in.
//
// horizon puts the pond behind the header: sky, the sun or the moon, one wave.
// It is for screens that carry figures, which get a strip of the scene instead
// of the whole of it.
//
// bare renders the children and nothing else. It is for a screen that has
// become one face of another screen — Finances and Stats inside Money — where
// the title, the eye and the gear belong to the screen above, and a second
// header inside the first would be both wrong and crooked.
export default function Screen({
  title,
  children,
  showBack,
  showBell = true,
  showPrivacyToggle = false,
  showSettings,
  horizon = false,
  bare = false,
}) {
  const { theme } = useTheme();
  const { t, hideAmounts, toggleHideAmounts } = useSettings();
  const navigation = useNavigation();
  const displayBack = showBack !== undefined ? showBack : navigation.canGoBack();
  const keyboardHeight = useKeyboardHeight();
  const { width } = useWindowDimensions();

  // Both the gear and the pond belong to the redesign, so the app in daily use
  // keeps the header and the tab bar it has until the whole thing moves across.
  const onWater = IS_DESIGN && horizon && !bare;
  const displaySettings = IS_DESIGN && (showSettings !== undefined ? showSettings : !displayBack);
  useStatusBarOnWater(onWater);

  if (bare) return <>{children}</>;

  const ink = onWater ? ON_WATER : theme.text;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Outside the SafeAreaView on purpose: the water has to run up under
          the status bar, and the safe area is the padding that keeps the title
          out of it. */}
      {onWater && <PondHorizon width={width} fadeTo={theme.background} />}

      <SafeAreaView style={[styles.safe, !onWater && { backgroundColor: theme.background }]} edges={['top']}>
        {title != null && (
          <View
            style={[
              styles.header,
              onWater
                ? { borderBottomColor: 'transparent', backgroundColor: 'transparent' }
                : { borderBottomColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            {displayBack && (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={24} color={onWater ? ink : theme.primary} />
              </TouchableOpacity>
            )}
            <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
              {title}
            </Text>
            {showPrivacyToggle && (
              <TouchableOpacity
                onPress={toggleHideAmounts}
                style={styles.privacyButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={hideAmounts ? t('common.showAmounts') : t('common.hideAmounts')}
              >
                {/* On water the eye keeps its two states in brightness, not
                    in hue: the accent green is close to invisible against the
                    day sky. The glyph changes either way, so the state is
                    never carried by colour alone. */}
                <Ionicons
                  name={hideAmounts ? 'eye-off' : 'eye-outline'}
                  size={22}
                  color={
                    onWater
                      ? hideAmounts
                        ? ON_WATER
                        : ON_WATER_DIM
                      : hideAmounts
                        ? theme.primary
                        : theme.textSecondary
                  }
                />
              </TouchableOpacity>
            )}
            {showBell && <NotificationBell color={onWater ? ink : undefined} />}
            {displaySettings && <SettingsGear color={onWater ? ink : undefined} />}
          </View>
        )}
        <View style={{ flex: 1, paddingBottom: keyboardHeight }}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
