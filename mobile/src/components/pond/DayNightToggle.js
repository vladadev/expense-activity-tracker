import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { ON_WATER } from './onWater';
import { motion } from '../../theme/scale';

// Sun or moon, in the corner of the pond.
//
// The redesign's eventual answer is that the app crosses over on its own at
// the real sunrise and sunset, with Light / Dark / Automatic in settings for
// anyone who does not want that. This is not a stand-in for it: once the
// crossing is automatic, this is still how you overrule it for an evening,
// and it is in the one place where the change is worth watching.
//
// The two do not cut from one to the other. One swings out as the other swings
// in, around the same centre, the way they actually trade places — and because
// an instant swap of a single glyph reads as a redraw rather than a change,
// which is exactly the wrong impression for the control that changes the most.
//
// Driven off the theme rather than off the press, so the icon is also right
// when the theme is changed from somewhere else, and so it settles correctly
// if it is tapped twice before the first move finishes.

const SIZE = 40;
const ICON = 22;

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  // An Animated.View around the glyph rather than an animated Ionicons: the
  // icon is a function component, and handing createAnimatedComponent one of
  // those is how you get a ref warning and, on some versions, a transform that
  // silently does nothing.
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});

export default function DayNightToggle({ onWater = false }) {
  const { theme, setThemeName } = useTheme();
  const { t } = useSettings();
  const night = theme.isDark;

  const swap = useRef(new Animated.Value(night ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(swap, {
      toValue: night ? 1 : 0,
      duration: motion.settle,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [night, swap]);

  // The sun leaves clockwise and the moon arrives from the other side, so the
  // pair reads as one thing turning rather than two things blinking.
  const sun = {
    opacity: swap.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] }),
    transform: [
      { rotate: swap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '70deg'] }) },
      { scale: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
    ],
  };
  const moon = {
    opacity: swap.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] }),
    transform: [
      { rotate: swap.interpolate({ inputRange: [0, 1], outputRange: ['-70deg', '0deg'] }) },
      { scale: swap.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
    ],
  };

  return (
    <Pressable
      onPress={() => setThemeName(night ? 'pondLight' : 'pondDark')}
      style={styles.button}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={night ? t('home.toDay') : t('home.toNight')}
    >
      {/* The sun keeps its own colour even over the water: it is the one thing
          in the header that is a picture of something rather than a symbol for
          it, and a white sun is a dot. */}
      <Animated.View style={[styles.icon, sun]} pointerEvents="none">
        <Ionicons name="sunny-outline" size={ICON} color={onWater ? '#F7C863' : theme.textSecondary} />
      </Animated.View>
      <Animated.View style={[styles.icon, moon]} pointerEvents="none">
        <Ionicons name="moon-outline" size={ICON} color={onWater ? ON_WATER : theme.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}
