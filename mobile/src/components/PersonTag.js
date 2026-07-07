import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getPersonColor } from '../utils/personColor';

// A small colored dot + the person's name — used everywhere an entry shows
// who added/owns it (expenses, savings, income, wishlist items, activity log)
// so the two of you can recognize each other's entries at a glance.
export default function PersonTag({ name, textStyle }) {
  if (!name) return null;
  const color = getPersonColor(name);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.name, { color }, textStyle]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  name: { fontSize: 13, fontWeight: '700' },
});
