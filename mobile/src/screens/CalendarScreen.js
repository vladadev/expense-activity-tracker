import React, { useMemo, useCallback, useState  } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { cachedGet } from '../api/cachedGet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { applyCalendarLocale } from '../i18n/calendarLocale';
import { formatLongDate } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import StaleNotice from '../components/StaleNotice';
import { useOnQueueFlushed } from '../context/OfflineQueueContext';
import { useOnDataEvent } from '../context/DataEventsContext';
import { BlurredText } from '../components/AmountText';
import AgendaScreen from './AgendaScreen';
import { usePersonColor } from '../context/PersonColorsContext';
import WeekRow from '../components/WeekRow';
import { space, radius, type, font, tabular, HIT } from '../theme/scale';
import { ON_WATER, ON_WATER_DIM } from '../components/pond/onWater';

const ACTIVITY_COLOR = '#F59E0B';

// How many of a day's entries the panel shows before it stops and says how
// many more there are. Three, because a panel that shows everything has to
// scroll and a panel that scrolls inside a screen that scrolls is a fight.
const DAY_PREVIEW = 3;

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// LOCAL date as YYYY-MM-DD — toISOString() converts to UTC, which between
// midnight and ~2am (UTC+ timezones) would mark YESTERDAY as "today".
function localDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayString() {
  return localDateString(new Date());
}

export default function CalendarScreen({ navigation }) {
  const personColor = usePersonColor();
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expenses, setExpenses] = useState([]);
  const [events, setEvents] = useState([]);
  // 'calendar' | 'list' — the month grid, or the agenda of every activity.
  const [view, setView] = useState('calendar');
  const today = todayString();
  // The month grid takes half the screen whether you are reading the month or
  // reading one day, and it is one day almost every time. Choosing a day
  // folds it to that day's week; the handle under it opens the month again.
  const [monthOpen, setMonthOpen] = useState(true);
  // The locale's short day names start on Sunday; the grid starts on Monday,
  // so the row has to be turned by one or the letters sit over the wrong days.
  const weekHeadings = useMemo(() => {
    const names = LocaleConfig.locales[LocaleConfig.defaultLocale]?.dayNamesShort ||
      LocaleConfig.locales['']?.dayNamesShort || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return [...names.slice(1), names[0]];
  }, [language]);
  const [selected, setSelected] = useState(today);
  // Set when the screen is showing its last good copy instead of live data.
  const [staleAt, setStaleAt] = useState(null);

  applyCalendarLocale(language);

  // One fetch feeds both the dot markers and the selected-day panel below,
  // so tapping around the month costs no extra requests.
  const load = useCallback(async () => {
    const now = new Date();
    const from = localDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = localDateString(new Date(now.getFullYear(), now.getMonth() + 2, 0));

    try {
      const [expensesRes, eventsRes] = await Promise.all([
        cachedGet('/expenses', { params: { from, to } }),
        cachedGet('/events', { params: { from, to } }),
      ]);
      setExpenses(expensesRes.data.expenses);
      setStaleAt(expensesRes.stale || eventsRes.stale ? expensesRes.at || eventsRes.at : null);
      setEvents(eventsRes.data.events);
    } catch (err) {
      console.log('Failed to load calendar data:', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Queued writes reached the server; take the authoritative version.
  useOnQueueFlushed(() => load());

  // The month grid aggregates per day, so recomputing it from the server is
  // simpler and no slower than merging a single record into every derived
  // total — the point here is that it happens without waiting for a revisit.
  useOnDataEvent((event) => {
    if (event.kind === 'expense' || event.kind === 'event') load();
  });

  // Two-tone dots: money on the left, plans on the right, so a glance at the
  // month tells you which kind of day it was without opening anything.
  const marks = {};
  for (const e of expenses) {
    const day = e.date.slice(0, 10);
    if (!marks[day]) marks[day] = { dots: [] };
    if (!marks[day].dots.some((d) => d.key === 'expense')) {
      marks[day].dots.push({ key: 'expense', color: theme.primary });
    }
  }
  for (const e of events) {
    const day = e.date.slice(0, 10);
    if (!marks[day]) marks[day] = { dots: [] };
    if (!marks[day].dots.some((d) => d.key === 'event')) {
      marks[day].dots.push({ key: 'event', color: ACTIVITY_COLOR });
    }
  }
  marks[selected] = {
    ...(marks[selected] || { dots: [] }),
    selected: true,
    selectedColor: theme.primary,
  };

  const dayEvents = events
    .filter((e) => e.date.slice(0, 10) === selected)
    .sort((a, b) => {
      if (!a.startTime && !b.startTime) return (a.order ?? 0) - (b.order ?? 0);
      if (!a.startTime) return -1;
      if (!b.startTime) return 1;
      return a.startTime.localeCompare(b.startTime);
    });

  const dayExpenses = expenses.filter((e) => e.date.slice(0, 10) === selected);
  const totalsByCurrency = {};
  for (const e of dayExpenses) {
    totalsByCurrency[e.currency] = (totalsByCurrency[e.currency] || 0) + e.amount;
  }
  const totalEntries = Object.entries(totalsByCurrency);

  const relativeLabel =
    selected === today
      ? t('agenda.today')
      : selected === localDateString(new Date(Date.now() + 86400000))
        ? t('agenda.tomorrow')
        : selected === localDateString(new Date(Date.now() - 86400000))
          ? t('agenda.yesterday')
          : null;

  return (
    <Screen title={t('nav.calendar')} showBack={false} showPrivacyToggle horizon>
      {/* The same control Money wears, in the same place, on the same water.
          The icons went: two switches sitting one tab apart, one with icons
          and one without, read as two different controls rather than one
          idea. The words are two and short, and carry it on their own. */}
      <View style={styles.switchRow}>
        <View style={styles.track}>
          {[
            { key: 'calendar', label: t('agenda.calendarView') },
            { key: 'list', label: t('agenda.listView') },
          ].map((seg) => {
            const active = view === seg.key;
            return (
              <Pressable
                key={seg.key}
                onPress={() => setView(seg.key)}
                hitSlop={{ top: 3, bottom: 3 }}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{seg.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <StaleNotice at={staleAt} />
      {view === 'list' ? (
        <AgendaScreen navigation={navigation} />
      ) : (
        // One scroll, on the screen itself. With the month open and a day
        // chosen — which is the state you land on — the grid, the handle, the
        // legend and the day below it come to more than a 844pt phone has, and
        // without this the bottom of the day was simply cut off.
        //
        // This is not the nested scroll that was taken out of the day panel.
        // That was a box scrolling inside a screen that scrolled: two gestures
        // in one place, and the finger cannot see which it has hold of. This is
        // the screen scrolling, and nothing scrolls inside it.
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: space.md }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.calendarCard}>
            {monthOpen ? (
            <Calendar
              key={theme.background /* re-render internal theme when palette changes */}
              current={today}
              markedDates={marks}
              markingType="multi-dot"
              onDayPress={(day) => {
                setSelected(day.dateString);
                setMonthOpen(false);
              }}
              enableSwipeMonths
              // Monday. The grid defaulted to Sunday, which is wrong for every
              // language this app speaks, and the week row below could not
              // have agreed with it.
              firstDay={1}
              theme={{
                calendarBackground: 'transparent',
                dayTextColor: theme.text,
                monthTextColor: theme.text,
                textDisabledColor: hexToRgba(theme.textSecondary, 0.35),
                todayTextColor: theme.primary,
                arrowColor: theme.primary,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#fff',
                textSectionTitleColor: theme.textSecondary,
                // The library draws this grid, so it has to be handed the
                // same type the rest of the app uses or the one screen made of
                // numbers ends up in the system font. Days are figures, so
                // they take Outfit; the weekday letters are read, so they
                // take Plex.
                textDayFontFamily: font.displayMedium,
                textDayFontSize: 17,
                textMonthFontFamily: font.display,
                textMonthFontSize: 18,
                textDayHeaderFontFamily: font.bodySemiBold,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendar}
            />
            ) : (
              <WeekRow
                selected={selected}
                today={today}
                marks={marks}
                headings={weekHeadings}
                onPick={setSelected}
              />
            )}

            {/* A handle you can see, not a swipe you have to guess at. The
                whole point of the day row below was that a control which works
                but does not look like one is a control nobody uses. */}
            <Pressable
              onPress={() => setMonthOpen((open) => !open)}
              style={styles.handle}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={monthOpen ? t('calendar.showWeek') : t('calendar.showMonth')}
            >
              <View style={styles.handleBar} />
              <Ionicons
                name={monthOpen ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={theme.textSecondary}
              />
            </Pressable>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
                <Text style={styles.legendText}>{t('nav.expenses')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: ACTIVITY_COLOR }]} />
                <Text style={styles.legendText}>{t('agenda.listView')}</Text>
              </View>
            </View>
          </View>

          {/* The space under a month grid is otherwise dead — filling it with
              the tapped day's summary removes a whole navigation step. */}
          <View style={styles.dayPanel}>
            <TouchableOpacity
              style={styles.dayPanelHeader}
              onPress={() => navigation.navigate('DayDetail', { date: selected })}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dayPanelTitle}>
                  {relativeLabel || formatLongDate(selected, language)}
                </Text>
                {relativeLabel && <Text style={styles.dayPanelDate}>{formatLongDate(selected, language)}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* No scroll in here. A scrolling box inside a scrolling screen
                is a fight between two gestures that the finger cannot see, and
                the panel was short enough to show two entries out of six. It
                shows three and says how many more there are. */}
            <View style={styles.dayBody}>
              {totalEntries.length > 0 && (
                <View style={styles.totalRow}>
                  <Ionicons name="wallet-outline" size={16} color={theme.primary} />
                  <BlurredText style={styles.totalText}>
                    {totalEntries.map(([cur, amt]) => formatAmount(amt, cur)).join('  ·  ')}
                  </BlurredText>
                  <Text style={styles.totalCount}>{dayExpenses.length}×</Text>
                </View>
              )}

              {dayEvents.slice(0, DAY_PREVIEW).map((e) => (
                <TouchableOpacity
                  key={e._id}
                  style={[styles.eventRow, { borderLeftColor: personColor(e.owner?.name) }]}
                  onPress={() => navigation.navigate('EventForm', { date: selected, eventId: e._id })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eventTime}>{e.startTime || t('agenda.allDayShort')}</Text>
                  <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                  {e.reminderEnabled && e.reminderAt && (
                    <Ionicons name="notifications-outline" size={14} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}

              {dayEvents.length > DAY_PREVIEW && (
                <TouchableOpacity
                  style={styles.moreRow}
                  onPress={() => navigation.navigate('DayDetail', { date: selected })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreText}>
                    {t('calendar.moreEntries', { count: dayEvents.length - DAY_PREVIEW })}
                  </Text>
                </TouchableOpacity>
              )}

              {totalEntries.length === 0 && dayEvents.length === 0 && (
                <Text style={styles.emptyDay}>{t('dayDetail.nothingPlanned')}</Text>
              )}
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate('ExpenseForm', { date: selected })}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={17} color={theme.primary} />
                <Text style={styles.quickActionText}>{t('nav.expenses')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate('EventForm', { date: selected })}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={17} color={theme.primary} />
                <Text style={styles.quickActionText}>{t('nav.activityPlan')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    // On the water, under the header, exactly where Money's switch sits.
    switchRow: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm },
    track: {
      flexDirection: 'row',
      borderRadius: radius.control + 4,
      padding: 4,
      // Dark veil, light hairline — a light film goes nearly white where the
      // sun passes behind it and takes the inactive label with it.
      backgroundColor: theme.isDark ? 'rgba(4, 15, 20, 0.5)' : 'rgba(7, 56, 47, 0.42)',
      borderWidth: 1,
      borderColor: 'rgba(244, 242, 236, 0.18)',
    },
    segment: {
      // flex, not flexGrow: equal halves need a basis of zero, or each segment
      // starts at the width of its own word.
      flex: 1,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.control,
    },
    segmentActive: { backgroundColor: theme.isDark ? theme.surface : ON_WATER },
    segmentText: { ...type.bodyStrong, fontSize: 14, color: ON_WATER_DIM },
    segmentTextActive: { color: theme.isDark ? theme.text : '#07382F' },

    calendarCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.card,
      marginHorizontal: space.md,
      paddingBottom: space.sm + 2,
      overflow: 'hidden',
      // The card carries its own edge in the dark, where surface and
      // background are close enough to merge without one.
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },
    calendar: { paddingBottom: space.xs },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: space.md + 2,
      paddingTop: space.sm - 2,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginHorizontal: space.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 1 },
    legendDot: { width: 7, height: 7, borderRadius: 3.5 },
    legendText: { ...type.secondary, fontSize: 12, color: theme.textSecondary },

    handle: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingTop: space.xs + 2,
      paddingBottom: space.xs,
    },
    handleBar: { width: 34, height: 4, borderRadius: 2, backgroundColor: theme.border },

    dayPanel: { marginTop: space.md - 2, paddingHorizontal: space.md },
    dayBody: { gap: space.xs + 2 },
    // The row has always opened the day. It never looked as though it would,
    // so nobody pressed it except on the arrow — which is the whole reason
    // the day was called hard to open. It is a button now, and looks like one.
    dayPanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: HIT,
      paddingHorizontal: space.sm + 4,
      marginBottom: space.sm + 2,
      borderRadius: radius.card,
      backgroundColor: theme.surface,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },
    dayPanelTitle: { ...type.section, color: theme.text },
    dayPanelDate: { ...type.secondary, color: theme.textSecondary, marginTop: 1 },

    moreRow: { justifyContent: 'center', minHeight: HIT - 10, paddingHorizontal: space.sm + 4 },
    moreText: { ...type.bodyStrong, fontSize: 13, color: theme.primary },

    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: theme.surface,
      borderRadius: radius.control,
      paddingVertical: space.sm + 2,
      paddingHorizontal: space.sm + 4,
      marginBottom: space.sm,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },
    totalText: { flex: 1, ...type.bodyStrong, color: theme.text },
    totalCount: { ...type.secondary, color: theme.textSecondary },

    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm + 2,
      minHeight: HIT,
      backgroundColor: theme.surface,
      borderRadius: radius.control,
      borderLeftWidth: 3,
      paddingVertical: space.sm + 2,
      paddingHorizontal: space.sm + 4,
      marginBottom: space.sm,
      borderTopWidth: theme.isDark ? 1 : 0,
      borderRightWidth: theme.isDark ? 1 : 0,
      borderBottomWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },
    // A time is a figure: Outfit, and tabular so 9:00 and 18:00 start at the
    // same place down the column. 44 is the width of the widest of them.
    eventTime: { ...type.secondary, fontFamily: font.bodySemiBold, ...tabular, color: theme.textSecondary, minWidth: 44 },
    eventTitle: { flex: 1, ...type.bodyStrong, color: theme.text },
    emptyDay: { ...type.secondary, color: theme.textSecondary, textAlign: 'center', paddingVertical: space.lg },

    quickActions: { flexDirection: 'row', gap: space.sm + 2, paddingVertical: space.sm + 2 },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs + 2,
      minHeight: HIT,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      borderRadius: radius.control + 2,
      paddingVertical: space.sm + 4,
    },
    quickActionText: { ...type.bodyStrong, fontSize: 14, color: theme.primary },
  });
}
