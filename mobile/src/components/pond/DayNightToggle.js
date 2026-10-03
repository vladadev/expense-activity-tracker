import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { ON_WATER } from './onWater';

// Sun or moon, in the corner of the pond.
//
// The redesign's eventual answer is that the app crosses over on its own at
// the real sunrise and sunset, with Light / Dark / Automatic in settings for
// anyone who does not want that. This is not a stand-in for it: once the
// crossing is automatic, this is still how you overrule it for an evening,
// and it is in the one place where the change is worth watching.
//
// Until then it earns its keep by making both themes a tap apart while they
// are being designed, instead of four taps into settings.

const styles = StyleSheet.create({
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});

export default function DayNightToggle({ onWater = false }) {
  const { theme, setThemeName } = useTheme();
  const { t } = useSettings();
  const night = theme.isDark;

  return (
    <TouchableOpacity
      onPress={() => setThemeName(night ? 'pondLight' : 'pondDark')}
      style={styles.button}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={night ? t('home.toDay') : t('home.toNight')}
    >
      {/* The sun keeps its own colour even over the water: it is the one thing
          in the header that is a picture of something rather than a symbol for
          it, and a white sun is a dot. */}
      <Ionicons
        name={night ? 'moon-outline' : 'sunny-outline'}
        size={22}
        color={onWater ? (night ? ON_WATER : '#F7C863') : theme.textSecondary}
      />
    </TouchableOpacity>
  );
}
