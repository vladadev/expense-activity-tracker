import React, { useCallback, useState } from 'react';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { applyCalendarLocale } from '../i18n/calendarLocale';
import Screen from '../components/Screen';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarScreen({ navigation }) {
  const { t, language } = useSettings();
  const { theme } = useTheme();
  const [markedDates, setMarkedDates] = useState({});
  const today = todayString();

  applyCalendarLocale(language);

  // Marks days that have expenses or events so the user can spot activity
  // at a glance before drilling into a specific date.
  const loadMarkedDates = useCallback(async () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);

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
    </Screen>
  );
}
