import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { applyCalendarLocale } from '../i18n/calendarLocale';
import Screen from '../components/Screen';
import AgendaScreen from './AgendaScreen';

// LOCAL date as YYYY-MM-DD — toISOString() converts to UTC, which between
// midnight and ~2am (UTC+ timezones) would mark YESTERDAY as "today".
function localDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayString() {
  return localDateString(new Date());
}

export default function CalendarScreen({ navigation }) {
  const { t, language } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [markedDates, setMarkedDates] = useState({});
  // 'calendar' | 'list' — the month grid, or the agenda of every activity.
  const [view, setView] = useState('calendar');
  const today = todayString();

  applyCalendarLocale(language);

  // Marks days that have expenses or events so the user can spot activity
  // at a glance before drilling into a specific date.
  const loadMarkedDates = useCallback(async () => {
    const now = new Date();
    const from = localDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = localDateString(new Date(now.getFullYear(), now.getMonth() + 2, 0));

    try {
      const [expensesRes, eventsRes] = await Promise.all([
        client.get('/expenses', { params: { from, to } }),
        client.get('/events', { params: { from, to } }),
      ]);

      const marks = {};
      for (const e of expensesRes.data.expenses) {
        const day = e.date.slice(0, 10);
        marks[day] = { ...(marks[day] || {}), marked: true, dotColor: theme.primary };
      }
      for (const e of eventsRes.data.events) {
        const day = e.date.slice(0, 10);
        marks[day] = { ...(marks[day] || {}), marked: true, dotColor: '#F59E0B' };
      }
      marks[today] = { ...(marks[today] || {}), today: true };
      setMarkedDates(marks);
    } catch (err) {
      console.log('Failed to load calendar marks:', err.message);
    }
  }, [today, theme.primary]);

  useFocusEffect(
    useCallback(() => {
      loadMarkedDates();
    }, [loadMarkedDates])
  );

  return (
    <Screen title={t('nav.calendar')} showBack={false}>
      <View style={styles.segmentRow}>
        {[
          { key: 'calendar', label: t('agenda.calendarView'), icon: 'calendar-outline' },
          { key: 'list', label: t('agenda.listView'), icon: 'list-outline' },
        ].map((seg) => (
          <TouchableOpacity
            key={seg.key}
            style={[styles.segment, view === seg.key && { backgroundColor: theme.primary }]}
            onPress={() => setView(seg.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={seg.icon} size={15} color={view === seg.key ? '#fff' : theme.textSecondary} />
            <Text style={[styles.segmentText, view === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'calendar' ? (
        <Calendar
          key={theme.background /* force re-render of internal theme when palette changes */}
          current={today}
          markedDates={markedDates}
          onDayPress={(day) => navigation.navigate('DayDetail', { date: day.dateString })}
          theme={{
            calendarBackground: theme.surface,
            dayTextColor: theme.text,
            monthTextColor: theme.text,
            textDisabledColor: theme.border,
            todayTextColor: theme.primary,
            arrowColor: theme.primary,
            selectedDayBackgroundColor: theme.primary,
            textSectionTitleColor: theme.textSecondary,
          }}
          style={{ backgroundColor: theme.surface }}
        />
      ) : (
        <AgendaScreen navigation={navigation} />
      )}
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 3,
      marginHorizontal: 16,
      marginTop: 12,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
    },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    segmentTextActive: { color: '#fff' },
  });
}
