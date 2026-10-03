import React, { useMemo } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useHouseholds } from '../context/HouseholdContext';
import { ON_WATER, ON_WATER_DIM } from './pond/onWater';
import { type, HIT } from '../theme/scale';

// Which household you are looking at.
//
// It exists because the app stopped having exactly one. You can belong to
// several — a home, a flat share, your parents' — and you see one at a time,
// with every screen in the app answering for that one. Without this the app
// never says which, and the same screen showing two different sets of figures
// on two different days is the kind of thing people stop trusting rather than
// report.
//
// So it is a label first and a control second: it names where you are, and
// tapping it is how you go somewhere else.

export default function HouseholdChip({ onWater = false }) {
  const { theme } = useTheme();
  const { active, loaded } = useHouseholds();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Nothing rather than an empty pill that fills in a moment later.
  if (!loaded || !active) return null;

  const ink = onWater ? ON_WATER : theme.text;

  return (
    <Pressable
      onPress={() => navigation.navigate('Settings', { screen: 'Household' })}
      style={[styles.chip, onWater ? styles.chipOnWater : styles.chipOnSurface]}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={active.name}
    >
      <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
        {active.name}
      </Text>
      <Ionicons name="chevron-down" size={15} color={onWater ? ON_WATER_DIM : theme.textSecondary} />
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      // 40 plus the 4 of hitSlop either side is the 48 a thumb needs. The pill
      // cannot be 48 itself without becoming the tallest thing in the header.
      height: HIT - 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      maxWidth: 160,
    },
    chipOnWater: { backgroundColor: 'rgba(7, 56, 47, 0.4)', borderColor: 'rgba(244, 242, 236, 0.26)' },
    chipOnSurface: { backgroundColor: theme.surface, borderColor: theme.border },
    name: { ...type.section, fontSize: 14, flexShrink: 1 },
  });
}
