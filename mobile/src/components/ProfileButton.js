import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import Frog from './pond/Frog';
import { HIT } from '../theme/scale';

// You, in the corner of every screen.
//
// It replaces the gear, and takes nothing extra: same place, same one tap,
// same destination. What changed is what it says. A gear says "options"; a
// face says "you", and the screen behind it now opens with who you are before
// it gets to what you can change.
//
// It is deliberately NOT a drawer. A panel behind an icon is a whole layer of
// navigation that nothing on the screen admits to, and this app has already
// been caught twice today with controls that worked and did not look like it.
// One tap, one screen, nothing hidden.

const SIZE = 30;

const styles = StyleSheet.create({
  button: { width: HIT - 8, height: HIT - 8, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  ring: {
    width: SIZE + 4,
    height: SIZE + 4,
    borderRadius: (SIZE + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
});

export default function ProfileButton({ onWater = false }) {
  const { theme } = useTheme();
  const { t } = useSettings();
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.navigate('Settings')}
      style={styles.button}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={t('nav.profile')}
    >
      <View
        style={[
          styles.ring,
          {
            backgroundColor: onWater ? 'rgba(7, 56, 47, 0.45)' : theme.surface,
            borderColor: onWater ? 'rgba(244, 242, 236, 0.5)' : theme.border,
          },
        ]}
      >
        {/* Still, because a frog breathing in the corner of every screen is
            movement with nothing to say. */}
        <Frog size={SIZE + 10} still style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}
