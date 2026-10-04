import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import PondHorizon from './PondHorizon';
import { ON_WATER, ON_WATER_DIM } from './onWater';
import { space, radius, type, HIT } from '../../theme/scale';

// Choosing the theme, over a pond that changes while you choose it.
//
// The crossing — the sun walking off one side as the moon rises on the other,
// with every colour in the app travelling with them — took a long time to get
// right, and moving the switch into settings would have meant it played behind
// a screen with no pond in it. Nobody would ever have seen it.
//
// So the control IS a piece of pond. This is the one screen you push into that
// has water on it, and the exception is not decoration: a theme picker that
// shows you the theme is the most defensible water in the app. Everywhere else
// a pushed screen stays dry.

const STRIP = 104;

export default function ThemePicker() {
  const { theme, themeName, setThemeName } = useTheme();
  const { t } = useSettings();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // The card has a gutter either side of it, and the strip has to be told how
  // wide it is: the pond is drawn, not laid out.
  const stripWidth = width - space.md * 2;

  const options = [
    { key: 'pondLight', label: t('settings.themeLight') },
    { key: 'pondDark', label: t('settings.themeDark') },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
        <PondHorizon width={stripWidth} height={STRIP} fadeTo={theme.surface} />
        <View style={styles.stripRow}>
          {options.map((option) => {
            const active = themeName === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setThemeName(option.key)}
                style={[styles.option, active && styles.optionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.note}>{t('settings.themeAutoSoon')}</Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { marginBottom: space.lg },
    strip: {
      height: STRIP,
      borderRadius: radius.card + 4,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: theme.surface,
    },
    stripRow: { flexDirection: 'row', gap: space.sm, padding: space.sm + 2 },
    option: {
      flex: 1,
      height: HIT - 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.control + 2,
      // The same dark veil the Money switch wears, for the same reason: a
      // light film over water goes almost white where the light passes behind
      // it, and takes the label with it. Darker here than on the Money switch,
      // because the sun lands squarely behind the second option and a label
      // should never sit on bare glow.
      backgroundColor: 'rgba(7, 56, 47, 0.52)',
      borderWidth: 1,
      borderColor: 'rgba(244, 242, 236, 0.18)',
    },
    optionActive: { backgroundColor: ON_WATER, borderColor: ON_WATER },
    optionText: { ...type.bodyStrong, fontSize: 14, color: ON_WATER_DIM },
    optionTextActive: { color: '#07382F' },
    note: { ...type.secondary, color: theme.textSecondary, marginTop: space.sm },
  });
}
