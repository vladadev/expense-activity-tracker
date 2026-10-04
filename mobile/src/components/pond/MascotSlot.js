import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IS_DESIGN } from '../../theme/variant';
import { ON_WATER, ON_WATER_DIM } from './onWater';
import { font } from '../../theme/scale';

// The hole the frog goes in.
//
// Reserved before it is drawn, deliberately. A slot kept only on paper quietly
// stops being kept: the layout around it closes up, and when the art arrives
// there is nowhere it fits without moving three other things. A visible hole
// is also honest — it can be judged at the real size, on the real screen, in
// both themes, long before anything is drawn.
//
// It renders in the design build only, so it cannot reach the app in daily
// use, and it is gone from the design build the moment a pose replaces it.
// The sizes are the ones in design/MASCOT.md.

export const MASCOT_SIZES = {
  onboarding: { width: 130, height: 130, pose: 'waving' },
  empty: { width: 96, height: 96, pose: 'sitting' },
  celebrate: { width: 96, height: 96, pose: 'celebrating' },
  // The home scene's frog is not in the table: it does no job there, it is the
  // one place the character is simply present. Sized to the water it sits on.
  scene: { width: 112, height: 124, pose: 'sitting' },
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 18,
    gap: 3,
    // Filled, not see-through. An empty outline lets the reeds, a lily pad and
    // its rings all wander through the reserved space, which reads as the
    // scene being broken rather than as a space being held — and it is not
    // what will be there either, because a frog is opaque. Reserving the solid
    // block is the honest preview.
    overflow: 'hidden',
  },
  label: { fontFamily: font.bodySemiBold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' },
  size: { fontFamily: font.body, fontSize: 10 },
});

export default function MascotSlot({ slot = 'scene', onWater = true, style }) {
  if (!IS_DESIGN) return null;

  const { width, height, pose } = MASCOT_SIZES[slot] || MASCOT_SIZES.scene;
  const ink = onWater ? ON_WATER : '#5C6B65';
  const dim = onWater ? ON_WATER_DIM : '#8D948E';

  return (
    <View
      pointerEvents="none"
      style={[
        styles.box,
        {
          width,
          height,
          borderColor: onWater ? 'rgba(244,242,236,0.55)' : '#C9D6D0',
          backgroundColor: onWater ? 'rgba(6, 38, 32, 0.72)' : 'rgba(244, 242, 236, 0.92)',
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: ink }]}>Frog</Text>
      <Text style={[styles.size, { color: dim }]}>{pose}</Text>
      <Text style={[styles.size, { color: dim }]}>
        {width} × {height}
      </Text>
    </View>
  );
}
