import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// The four tab icons, drawn rather than borrowed.
//
// Rounder than a stock set and on a softer stroke — the corners a leaf has
// rather than the ones a form has. The active one fills in AND changes colour,
// so the mark never rests on colour alone: someone who cannot separate the
// green from the grey still sees which one is solid.
//
// Money went through three shapes before this one. A coin with a stroke down
// its middle read as an exclamation mark at twenty-three pixels. A banknote —
// a rounded box with a circle in it — read as a camera lens. A wallet cannot
// be mistaken for anything else, and it says household money rather than
// currency, which matters in an app that counts dinars and should not wear a
// dollar sign.

const SIZE = 23;

function Frame({ children }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function HomeIcon({ color, active }) {
  const w = active ? 2 : 1.9;
  return (
    <Frame>
      <Path d="M3.6 11.2 12 4.2l8.4 7" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M6 10.2v8.4a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4v-8.4"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active ? (
        <Path d="M9.6 20v-4.3a2.4 2.4 0 0 1 4.8 0V20" fill={color} />
      ) : (
        <Path
          d="M9.6 20v-4.3a2.4 2.4 0 0 1 4.8 0V20"
          stroke={color}
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Frame>
  );
}

export function CalendarIcon({ color, active, surface }) {
  return (
    <Frame>
      <Rect
        x="3.4"
        y="5.4"
        width="17.2"
        height="15"
        rx="4"
        fill={active ? color : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={1.9}
      />
      <Path d="M3.4 10h17.2" stroke={active ? surface : color} strokeWidth={active ? 1.6 : 1.9} strokeLinecap="round" />
      <Path d="M8.4 3.4v3.4" stroke={color} strokeWidth={active ? 2 : 1.9} strokeLinecap="round" />
      <Path d="M15.6 3.4v3.4" stroke={color} strokeWidth={active ? 2 : 1.9} strokeLinecap="round" />
      <Circle cx="8.6" cy="14.5" r="1.27" fill={active ? surface : color} />
      <Circle cx="12" cy="14.5" r="1.27" fill={active ? surface : color} />
    </Frame>
  );
}

export function WalletIcon({ color, active, surface }) {
  return (
    <Frame>
      <Path
        d="M3 8.4a2.6 2.6 0 0 1 2.6-2.6h11.2A2.6 2.6 0 0 1 19.4 8.4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Rect
        x="2.6"
        y="8.2"
        width="18.8"
        height="10.6"
        rx="3"
        fill={active ? color : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={1.8}
      />
      <Path
        d="M21.4 11.6h-3.9a1.9 1.9 0 0 0 0 3.8h3.9"
        fill={active ? surface : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx="18.1" cy="13.5" r="0.95" fill={active ? color : color} />
    </Frame>
  );
}

export function ListsIcon({ color, active }) {
  const w = active ? 2 : 1.9;
  return (
    <Frame>
      <Path d="M4 6.6 5.6 8.3 8.4 5.2" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 12.4 5.6 14.1 8.4 11" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11.6 6.6h8.4" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M11.6 12.4h8.4" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M11.6 18.6h5.6" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </Frame>
  );
}

export function StatsIcon({ color, active }) {
  const w = active ? 2 : 1.9;
  return (
    <Frame>
      <Path d="M4 19.6h16" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Rect x="5.2" y="11" width="3.6" height="6" rx="1.8" fill={active ? color : 'none'} stroke={active ? 'none' : color} strokeWidth={w} />
      <Rect x="10.2" y="6.6" width="3.6" height="10.4" rx="1.8" fill={active ? color : 'none'} stroke={active ? 'none' : color} strokeWidth={w} />
      <Rect x="15.2" y="9" width="3.6" height="8" rx="1.8" fill={active ? color : 'none'} stroke={active ? 'none' : color} strokeWidth={w} />
    </Frame>
  );
}

export function SettingsIcon({ color, active }) {
  const w = active ? 2 : 1.9;
  return (
    <Frame>
      <Circle cx="12" cy="12" r="3.1" fill={active ? color : 'none'} stroke={active ? 'none' : color} strokeWidth={w} />
      <Path
        d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </Frame>
  );
}

// Keyed by the route names the navigator actually uses. A name with no icon
// falls back rather than crashing the whole bar.
export const TAB_ICONS = {
  Calendar: CalendarIcon,
  Stats: StatsIcon,
  Finances: WalletIcon,
  Wishlist: ListsIcon,
  Settings: SettingsIcon,
  Home: HomeIcon,
};
