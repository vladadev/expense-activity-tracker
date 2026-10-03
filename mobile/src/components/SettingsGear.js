import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';

// Settings, as a gear in the header rather than a tab.
//
// It was taking the same room in the tab bar as the screens opened every day
// while being opened about once a month, and six tabs across a 390pt phone
// leave 63pt each — not enough for the word "Podešavanja" to fit under the
// icon. In the header it costs nothing and is reachable from every screen.
//
// `navigate` rather than `push`: the route lives on the outer stack, above the
// tabs, so the request bubbles up out of whichever tab it was tapped in. That
// is the same path the notification bell already takes.

const styles = StyleSheet.create({
  button: { padding: 4, marginLeft: 8 },
});

export default function SettingsGear({ color }) {
  const { theme } = useTheme();
  const { t } = useSettings();
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      style={styles.button}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t('nav.settings')}
    >
      <Ionicons name="settings-outline" size={23} color={color || theme.text} />
    </TouchableOpacity>
  );
}
