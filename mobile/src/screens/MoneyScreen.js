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
                // 42 high with 3 either side is the 48 a thumb needs.
                hitSlop={{ top: 3, bottom: 3 }}
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
      // The segment's radius plus the padding around it, so the two curves are
      // concentric rather than nearly so.
      borderRadius: radius.control + 4,
      padding: 4,
      // A DARK veil over the water, with a hairline of light to give it an
      // edge. The first version used a light film, which is wrong in a way
      // that only shows on the phone: the sun passes behind this control, a
      // light film goes nearly white where it does, and the inactive label —
      // itself nearly white — vanishes into it. Dark keeps both labels legible
      // whatever the strip is doing behind them.
      backgroundColor: theme.isDark ? 'rgba(4, 15, 20, 0.5)' : 'rgba(7, 56, 47, 0.42)',
      borderWidth: 1,
      borderColor: 'rgba(244, 242, 236, 0.18)',
    },
    // flex, not flexGrow. flexGrow shares out the SPARE space while each
    // segment still starts at the width of its own word, so "Analiza" would
    // sit in a wider half than "Sada". Equal halves need a basis of zero,
    // which is what RN's `flex: 1` sets.
    segment: {
      flex: 1,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.control,
    },
    segmentActive: { backgroundColor: theme.isDark ? theme.surface : ON_WATER },
    segmentText: { ...type.bodyStrong, fontSize: 14, color: ON_WATER_DIM },
    segmentTextActive: { color: theme.isDark ? theme.text : '#07382F' },
  });
}
