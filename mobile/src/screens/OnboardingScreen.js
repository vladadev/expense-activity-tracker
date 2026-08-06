import React, { useMemo, useRef, useState  } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Per-account, like the theme/language preferences — if a partner logs in on
// the same phone they still get their own intro.
export const onboardingKey = (userId) => `onboarding_done_${userId}`;

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function OnboardingScreen({ onDone }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);

  const slides = [
    { icon: 'wallet-outline', color: theme.primary, title: t('onboarding.title1'), body: t('onboarding.body1') },
    { icon: 'people-outline', color: '#DB2777', title: t('onboarding.title2'), body: t('onboarding.body2') },
    { icon: 'calendar-outline', color: '#F59E0B', title: t('onboarding.title3'), body: t('onboarding.body3') },
  ];

  async function finish() {
    try {
      await AsyncStorage.setItem(onboardingKey(user.id), '1');
    } catch (e) {
      // Not being able to persist the flag is not worth blocking entry.
    }
    onDone();
  }

  function next() {
    if (page >= slides.length - 1) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_WIDTH, animated: true });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.skip} onPress={finish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
        scrollEventThrottle={16}
        style={{ flexGrow: 0 }}
      >
        {slides.map((slide) => (
          <View key={slide.title} style={styles.slide}>
            <View style={[styles.iconWrap, { backgroundColor: hexToRgba(slide.color, 0.12) }]}>
              <Ionicons name={slide.icon} size={46} color={slide.color} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={slide.title}
              style={[
                styles.dot,
                i === page ? { width: 20, backgroundColor: theme.primary } : { backgroundColor: theme.border },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={next} activeOpacity={0.85}>
          <Text style={styles.buttonText}>
            {page >= slides.length - 1 ? t('onboarding.start') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background, justifyContent: 'space-between' },
    skip: { alignSelf: 'flex-end', padding: 16 },
    skipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '600' },
    slide: { width: SCREEN_WIDTH, alignItems: 'center', paddingHorizontal: 36 },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 26,
    },
    title: { fontSize: 21, fontWeight: '700', color: theme.text, textAlign: 'center', marginBottom: 10 },
    body: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
    footer: { padding: 24 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    button: { backgroundColor: theme.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
