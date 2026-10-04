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
import { space, radius, type, HIT } from '../theme/scale';

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
    <Screen title={t('nav.calendar')} showBack={false} showPrivacyToggle>
      <View style={styles.segmentWrap}>
        <View style={styles.segmentRow}>
          {[
            { key: 'calendar', label: t('agenda.calendarView'), icon: 'calendar-outline' },
            { key: 'list', label: t('agenda.listView'), icon: 'list-outline' },
          ].map((seg) => (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, view === seg.key && styles.segmentActive]}
              onPress={() => setView(seg.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={seg.icon} size={16} color={view === seg.key ? '#fff' : theme.textSecondary} />
              <Text style={[styles.segmentText, view === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <StaleNotice at={staleAt} />
      {view === 'list' ? (
        <AgendaScreen navigation={navigation} />
      ) : (
        <View style={{ flex: 1 }}>
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
                // Larger type: the month grid is the focal point of this
                // screen, and the default sizing left it small and cramped.
                textDayFontSize: 17,
                textDayFontWeight: '500',
                textMonthFontSize: 18,
                textMonthFontWeight: '700',
                textDayHeaderFontSize: 12,
                textDayHeaderFontWeight: '600',
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
        </View>
      )}
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    // Sits on the page background, not on a surface, so it reads as a
    // control above the calendar rather than part of it.
    segmentWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: hexToRgba(theme.textSecondary, 0.1),
      borderRadius: 12,
      padding: 4,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 9,
    },
    segmentActive: {
      backgroundColor: theme.primary,
    },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    segmentTextActive: { color: '#fff' },
    calendarCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      marginHorizontal: 16,
      marginTop: 8,
      paddingBottom: 10,
      overflow: 'hidden',
    },
    calendar: { paddingBottom: 4 },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 18,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginHorizontal: 16,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 3.5 },
    legendText: { fontSize: 11, color: theme.textSecondary },
    dayPanel: { flex: 1, marginTop: space.md - 2, paddingHorizontal: space.md },
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
    moreRow: { justifyContent: 'center', minHeight: HIT - 10, paddingHorizontal: space.sm + 4 },
    moreText: { ...type.bodyStrong, fontSize: 13, color: theme.primary },
    handle: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingTop: space.xs + 2,
      paddingBottom: space.xs,
    },
    handleBar: { width: 34, height: 4, borderRadius: 2, backgroundColor: theme.border },
    dayPanelTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    dayPanelDate: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    totalText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },
    totalCount: { fontSize: 12, color: theme.textSecondary },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderLeftWidth: 3,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    eventTime: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, minWidth: 44 },
    eventTitle: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.text },
    emptyDay: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', paddingVertical: 20 },
    quickActions: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      borderRadius: 12,
      paddingVertical: 12,
    },
    quickActionText: { color: theme.primary, fontSize: 13, fontWeight: '700' },
  });
}
