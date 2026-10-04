import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cachedGet } from '../api/cachedGet';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useHouseholds } from '../context/HouseholdContext';
import { usePersonColor } from '../context/PersonColorsContext';
import PondScene from '../components/pond/PondScene';
import { ON_WATER, ON_WATER_DIM, useStatusBarOnWater } from '../components/pond/onWater';
import Frog from '../components/pond/Frog';
import { SCENE, LEAF_VIEWBOX } from '../components/pond/geometry';
import { FOOT_LINE } from '../components/pond/frogShapes';
import HouseholdChip from '../components/HouseholdChip';
import NotificationBell from '../components/NotificationBell';
import ProfileButton from '../components/ProfileButton';
import Money from '../components/AmountText';
import LoadFailed from '../components/LoadFailed';
import StaleNotice from '../components/StaleNotice';
import { SkeletonBlock, useDeferredSkeleton } from '../components/Skeleton';
import { space, radius, type } from '../theme/scale';

// The screen the app opens on.
//
// It answers one question — where do we stand, and what is coming — because
// neither of the two halves of this app could answer it alone. Opening on the
// calendar said this was a planner with money bolted on; opening on the
// finances said the opposite. It is for both, equally.
//
// The pond takes the top, where the greeting is, and fades out before the
// first figure. The month sits on solid ground above it: the scene is behind
// the app, never behind a number.

const SCENE_RATIO = 0.46;

// Big enough to have a face at arm's length, small enough to leave the pad it
// sits on visible in front of it.
const FROG_SIZE = 96;

function localDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthRange(now) {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: localDay(from), to: localDay(to), daysLeft: to.getDate() - now.getDate() };
}

// Morning, afternoon or evening, from the phone's own clock. Not a detail
// worth a round trip, and wrong by an hour matters less than a greeting that
// says good morning at nine at night.
function greetingKey(hour) {
  if (hour < 5) return 'home.greetNight';
  if (hour < 12) return 'home.greetMorning';
  if (hour < 18) return 'home.greetDay';
  return 'home.greetEvening';
}

export default function HomeScreen({ navigation }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { activeId } = useHouseholds();
  const personColor = usePersonColor();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // The pond runs up under the status bar here, and the theme asks for dark
  // icons by day — on the darkest thing in the app.
  useStatusBarOnWater();

  const [spent, setSpent] = useState(0);
  const [earned, setEarned] = useState(0);
  const [today, setToday] = useState([]);
  const [tomorrow, setTomorrow] = useState([]);
  const [currency, setCurrency] = useState('RSD');
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [staleAt, setStaleAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const { from, to, daysLeft } = monthRange(now);
  const todayKey = localDay(now);
  const tomorrowKey = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const load = useCallback(async () => {
    try {
      const [expensesRes, incomeRes, todayRes, tomorrowRes] = await Promise.all([
        cachedGet('/expenses', { params: { from, to } }),
        cachedGet('/income'),
        cachedGet('/events', { params: { date: todayKey } }),
        cachedGet('/events', { params: { date: tomorrowKey } }),
      ]);

      const expenses = expensesRes.data.expenses || [];
      setSpent(expenses.reduce((sum, e) => sum + (e.amount || 0), 0));
      if (expenses[0]?.currency) setCurrency(expenses[0].currency);

      const inMonth = (entry) => {
        const day = (entry.date || '').slice(0, 10);
        return day >= from && day <= to;
      };
      setEarned((incomeRes.data.entries || []).filter(inMonth).reduce((sum, e) => sum + (e.amount || 0), 0));

      const byTime = (a, b) => (a.startTime || '').localeCompare(b.startTime || '');
      setToday([...(todayRes.data.events || [])].sort(byTime));
      setTomorrow([...(tomorrowRes.data.events || [])].sort(byTime));

      setStaleAt(expensesRes.stale ? expensesRes.at : null);
      setLoaded(true);
      setLoadFailed(false);
    } catch (err) {
      // A read that failed is not an empty month. Saying "nothing spent" when
      // the figure could not be fetched is the lie this app has already been
      // caught telling once.
      console.log('Failed to load home:', err.message);
      setLoadFailed(true);
    }
  }, [from, to, todayKey, tomorrowKey, activeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const showSkeleton = useDeferredSkeleton(!loaded);
  const sceneHeight = Math.round(width * SCENE_RATIO * 1.75);
  // The lily pad the frog sits on, in the scene's own coordinates, so the
  // reserved slot can be put on it rather than near it.
  const perch = useMemo(() => {
    const height = (SCENE.perchW * LEAF_VIEWBOX.height) / LEAF_VIEWBOX.width;
    return { height, top: sceneHeight * (SCENE.perchY + SCENE.drop) - height / 2 };
  }, [sceneHeight]);
  const remaining = earned - spent;
  const ratio = earned > 0 ? Math.min(1, spent / earned) : 0;

  return (
    <View style={styles.screen}>
      <PondScene width={width} height={sceneHeight} fadeTo={theme.background}>
        {/* Sitting ON the pad: centred on the perch, with its FEET a little
            past the pad's middle, so a crescent of pad shows in front of it.
            Its feet were at a third of the pad's depth before, which put it on
            the back rim — and the box was aimed at the pad rather than the
            foot line, which lifted it further still. */}
        <Frog
          size={FROG_SIZE}
          style={{
            position: 'absolute',
            left: width * SCENE.perchX - FROG_SIZE / 2,
            top: perch.top + perch.height * 0.62 - FROG_SIZE * FOOT_LINE,
          }}
        />
      </PondScene>

      <ScrollView
        contentContainerStyle={{ paddingBottom: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
      >
        {/* This screen draws its own header, because it has no title to put in
            one — the greeting is the title, and it is too big to sit in a row
            of controls. So the controls take the row and the greeting goes
            under it: which household you are in on the left, and on the right
            the day, your notifications and your settings. */}
        <View style={[styles.topRow, { paddingTop: insets.top + space.md }]}>
          <HouseholdChip onWater />
          <View style={{ flex: 1 }} />
          <NotificationBell color={ON_WATER} />
          <ProfileButton onWater />
        </View>

        <View style={styles.greeting}>
          <Text style={styles.hello} numberOfLines={2}>
            {t(greetingKey(now.getHours()), { name: user?.name || '' })}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {today.length > 0 ? t('home.planned', { count: today.length }) : t('home.nothingToday')}
          </Text>
        </View>

        <View style={{ height: sceneHeight * 0.3 }} />

        <View style={styles.body}>
          <StaleNotice at={staleAt} />

          {!loaded && loadFailed ? (
            <View style={styles.card}>
              <LoadFailed onRetry={load} />
            </View>
          ) : !loaded ? (
            showSkeleton ? (
              <View style={styles.card}>
                <SkeletonBlock width={160} height={34} radius={10} y={200} />
              </View>
            ) : (
              <View style={styles.card} />
            )
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.label}>{t('home.thisMonth')}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.sublabel}>{t('home.daysLeft', { count: daysLeft })}</Text>
              </View>
              <Money value={spent} currency={currency} style={styles.hero} />
              <Text style={styles.sublabel}>
                {t('home.spentOf')} <Text style={styles.strong}>{earned.toLocaleString('sr-RS')}</Text>
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <Text style={[styles.sublabel, { marginTop: space.sm }]}>
                {remaining >= 0 ? t('home.remaining') : t('home.over')}{' '}
                <Text style={styles.strong}>{Math.abs(remaining).toLocaleString('sr-RS')}</Text>
              </Text>
            </View>
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.section}>{t('home.today')}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => navigation.navigate('Calendar')} hitSlop={8}>
              <Text style={styles.link}>{t('nav.calendar')}</Text>
            </Pressable>
          </View>

          {today.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.sublabel}>{t('home.nothingToday')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {today.slice(0, 3).map((e, i) => (
                <View
                  key={e._id}
                  style={[styles.row, { borderLeftColor: personColor(e.owner?.name) }, i > 0 && styles.rowDivided]}
                >
                  <Text style={styles.time}>{e.startTime || t('agenda.allDayShort')}</Text>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {e.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {tomorrow.length > 0 && (
            <View style={styles.tomorrow}>
              <Text style={styles.label}>{t('home.tomorrow')}</Text>
              <Text style={styles.tomorrowText} numberOfLines={1}>
                {tomorrow[0].title}
              </Text>
            </View>
          )}

          <Pressable
            style={styles.add}
            onPress={() => navigation.navigate('Calendar', { screen: 'ExpenseForm', params: { date: todayKey } })}
          >
            <Text style={styles.addText}>{t('nav.addExpense')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
    greeting: { paddingHorizontal: space.md, paddingTop: space.sm },
    hello: { ...type.title, fontSize: 25, lineHeight: 30, color: ON_WATER, maxWidth: 230 },
    // Held to the same width as the greeting above it, so a long line of
    // plans cannot run under the frog's corner.
    sub: { ...type.secondary, color: ON_WATER_DIM, marginTop: 5, maxWidth: 230 },
    body: { paddingHorizontal: space.md, gap: space.md },
    card: {
      padding: space.lg - 4,
      backgroundColor: theme.surface,
      borderRadius: radius.card + 4,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      shadowColor: '#07382F',
      shadowOpacity: theme.isDark ? 0 : 0.16,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 10 },
      elevation: theme.isDark ? 0 : 6,
    },
    cardHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space.sm + 4 },
    label: { ...type.label, color: theme.textSecondary },
    sublabel: { ...type.secondary, color: theme.textSecondary },
    strong: { ...type.bodyStrong, fontSize: 13, color: theme.text },
    hero: { ...type.amountLarge, fontSize: 40, color: theme.text },
    track: { height: 8, borderRadius: 4, backgroundColor: theme.border, marginTop: space.md - 2, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4, backgroundColor: theme.primary },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline' },
    section: { ...type.section, color: theme.text },
    link: { ...type.secondary, color: theme.primary },
    list: { backgroundColor: theme.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 4, padding: space.md - 3, borderLeftWidth: 3 },
    rowDivided: { borderTopWidth: 1, borderTopColor: theme.background },
    time: { ...type.amountSmall, width: 44, color: theme.textSecondary },
    rowTitle: { ...type.bodyStrong, flex: 1, color: theme.text },
    tomorrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm + 2,
      padding: space.md - 4,
      borderRadius: radius.card,
      backgroundColor: theme.border,
    },
    tomorrowText: { ...type.secondary, flex: 1, color: theme.text },
    add: {
      height: 54,
      borderRadius: radius.card,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: { ...type.section, fontSize: 16, color: theme.isDark ? '#06201A' : '#FFFFFF' },
  });
}
