import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import FinancesScreen from './FinancesScreen';
import StatsScreen from './StatsScreen';
import { ON_WATER, ON_WATER_DIM } from '../components/pond/onWater';
import { space, radius, type } from '../theme/scale';

// Money, with two faces.
//
// Statistics used to be its own tab and it was the screen he liked least. The
// drawing was never the problem: it had no question of its own to answer. "How
// has it been" is the second half of "where do we stand", and the two halves
// were two tabs apart, so the first was checked daily and the second almost
// never.
//
// Folding it in here also pays for Home. Six tabs across a 390pt phone leave
// 63pt each; four leave 97. Nothing was deleted to get there — one screen
// became a face of another, and one became a gear in the header.
//
// Both faces are whole screens still, and still work on their own: each is
// rendered `embedded`, which means it draws its body and lets the title, the
// eye and the gear up here belong to Money.

const FACES = [
  { key: 'now', labelKey: 'money.now' },
  { key: 'analysis', labelKey: 'money.analysis' },
];

export default function MoneyScreen({ navigation }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [face, setFace] = useState('now');

  return (
    <Screen title={t('nav.money')} showBack={false} showPrivacyToggle horizon>
      <View style={styles.switchRow}>
        <View style={styles.track}>
          {FACES.map((f) => {
            const active = f.key === face;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFace(f.key)}
                // 38 high with 6 either side comes to 50: the control has to
                // fit inside the horizon strip, and the thumb still gets its
                // 48.
                hitSlop={{ top: 6, bottom: 6 }}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(f.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {face === 'now' ? (
        <FinancesScreen navigation={navigation} embedded />
      ) : (
        <StatsScreen navigation={navigation} embedded />
      )}
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    switchRow: { paddingHorizontal: space.md, paddingBottom: space.sm },
    track: {
      flexDirection: 'row',
      borderRadius: radius.pill,
      padding: 3,
      // Over the water, not over a surface: a solid chip here would be a bar
      // laid across the pond.
      backgroundColor: 'rgba(244, 242, 236, 0.16)',
    },
    // flex, not flexGrow. flexGrow shares out the SPARE space while each
    // segment still starts at the width of its own word, so "Analiza" would
    // sit in a wider half than "Sada". Equal halves need a basis of zero,
    // which is what RN's `flex: 1` sets.
    segment: {
      flex: 1,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    segmentActive: { backgroundColor: ON_WATER },
    segmentText: { ...type.bodyStrong, fontSize: 14, color: ON_WATER_DIM },
    segmentTextActive: { color: theme.isDark ? '#06201A' : '#07382F' },
  });
}
