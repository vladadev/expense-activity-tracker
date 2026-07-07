import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { formatLongDate, formatTime } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';

export default function DayDetailScreen({ route, navigation }) {
  const { date } = route.params;
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [byCurrency, setByCurrency] = useState({});
  const [events, setEvents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        client.get(`/stats/${date}`),
        client.get('/events', { params: { date } }),
      ]);
      setByCurrency(statsRes.data.byCurrency);
      setEvents(eventsRes.data.events);
      setLoaded(true);
    } catch (err) {
      console.log('Failed to load day detail:', err.message);
    }
  }, [date]);

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

  function formatDateHeading(dateString) {
    return formatLongDate(dateString, language);
  }

  const currencies = Object.keys(byCurrency);

  return (
    <Screen title={formatDateHeading(date)}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ExpenseStats', { date })}
      >
        <Text style={styles.cardTitle}>{t('dayDetail.expenses')}</Text>
        {!loaded ? (
          <Text style={styles.cardSubtext}>{t('dayDetail.loading')}</Text>
        ) : currencies.length === 0 ? (
          <Text style={styles.cardSubtext}>{formatAmount(0)} {t('dayDetail.total')}</Text>
        ) : (
          currencies.map((currency) => (
            <View key={currency} style={{ marginBottom: 4 }}>
              <Text style={styles.cardTotal}>
                {formatAmount(byCurrency[currency].total, currency)} {t('dayDetail.total')}
              </Text>
              <Text style={styles.cardSubtext}>
                {t('dayDetail.personal')}: {formatAmount(byCurrency[currency].personalTotal, currency)} ·{' '}
                {t('dayDetail.together')}: {formatAmount(byCurrency[currency].togetherTotal, currency)}
              </Text>
            </View>
          ))
        )}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('ExpenseForm', { date })}
        >
          <Text style={styles.addButtonText}>{t('dayDetail.addExpense')}</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('dayDetail.activities')}</Text>
        {events.length === 0 ? (
          <Text style={styles.cardSubtext}>{t('dayDetail.nothingPlanned')}</Text>
        ) : (
          events.map((e) => (
            <TouchableOpacity
              key={e._id}
              style={[styles.eventRow, { borderLeftWidth: 4, borderLeftColor: getPersonColor(e.owner?.name), paddingLeft: 8 }]}
              onPress={() => navigation.navigate('EventForm', { date, eventId: e._id })}
            >
              <View style={styles.eventTitleRow}>
                <Text style={[styles.eventTitle, { flex: 1 }]}>{eventTypeIcon(e.type)} {e.title}</Text>
                {e.reminderEnabled && e.reminderAt ? (
                  <Text style={styles.eventTime}>{formatTime(new Date(e.reminderAt))}</Text>
                ) : null}
              </View>
              {e.notes ? <Text style={styles.cardSubtext}>{e.notes}</Text> : null}
              <PersonTag name={e.owner?.name} />
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('EventForm', { date })}
        >
          <Text style={styles.addButtonText}>{t('dayDetail.addActivity')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </Screen>
  );
}

function eventTypeIcon(type) {
  switch (type) {
    case 'birthday': return '🎂';
    case 'plan': return '📌';
    case 'reminder': return '⏰';
    default: return '📝';
  }
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    heading: { fontSize: 20, fontWeight: '700', margin: 16, color: theme.text },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6, color: theme.text },
    cardTotal: { fontSize: 22, fontWeight: '700', color: theme.text },
    cardSubtext: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
    addButton: {
      marginTop: 12,
      backgroundColor: theme.primaryLight,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },
    addButtonText: { color: theme.primary, fontWeight: '600' },
    eventRow: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center' },
    eventTitle: { fontSize: 15, fontWeight: '500', color: theme.text },
    eventTime: { fontSize: 13, fontWeight: '600', color: theme.primary, marginLeft: 8 },
  });
}
