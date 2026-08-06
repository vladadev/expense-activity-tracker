import React, { useMemo, useCallback, useState  } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { formatLongDate, formatTime } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import Money from '../components/AmountText';
import { getPersonColor } from '../utils/personColor';

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function DayDetailScreen({ route, navigation }) {
  const { date } = route.params;
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

  const currencies = Object.keys(byCurrency);
  const sortedEvents = [...events].sort((a, b) => {
    if (!a.startTime && !b.startTime) return (a.order ?? 0) - (b.order ?? 0);
    if (!a.startTime) return -1;
    if (!b.startTime) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <Screen title={formatLongDate(date, language)} showPrivacyToggle>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Expenses. The card header navigates to the breakdown; the add
            button is a sibling, not a child — nesting it inside the card's
            touchable made one tap fire both actions. */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => navigation.navigate('ExpenseStats', { date })}
            activeOpacity={0.7}
          >
            <View style={[styles.cardIcon, { backgroundColor: hexToRgba(theme.primary, 0.12) }]}>
              <Ionicons name="wallet-outline" size={19} color={theme.primary} />
            </View>
            <Text style={styles.cardTitle}>{t('nav.expenses')}</Text>
            <Ionicons name="chevron-forward" size={19} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.cardBody}>
            {!loaded ? (
              <Text style={styles.subtext}>{t('dayDetail.loading')}</Text>
            ) : currencies.length === 0 ? (
              <Text style={styles.subtext}>{t('expenseStats.noneYet')}</Text>
            ) : (
              currencies.map((currency) => (
                <View key={currency} style={styles.totalBlock}>
                  <Money value={byCurrency[currency].total} currency={currency} style={styles.totalValue} />
                  <View style={styles.splitRow}>
                    <View style={styles.splitItem}>
                      <Text style={styles.splitLabel}>{t('dayDetail.personal')}</Text>
                      <Money
                        value={byCurrency[currency].personalTotal}
                        currency={currency}
                        style={styles.splitValue}
                      />
                    </View>
                    <View style={styles.splitDivider} />
                    <View style={styles.splitItem}>
                      <Text style={styles.splitLabel}>{t('dayDetail.together')}</Text>
                      <Money
                        value={byCurrency[currency].togetherTotal}
                        currency={currency}
                        style={styles.splitValue}
                      />
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('ExpenseForm', { date })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={17} color={theme.primary} />
            <Text style={styles.addButtonText}>{t('nav.addExpense')}</Text>
          </TouchableOpacity>
        </View>

        {/* Activities */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: hexToRgba('#F59E0B', 0.14) }]}>
              <Ionicons name="calendar-outline" size={19} color="#F59E0B" />
            </View>
            <Text style={styles.cardTitle}>{t('dayDetail.activities')}</Text>
            {sortedEvents.length > 0 && <Text style={styles.countBadge}>{sortedEvents.length}</Text>}
          </View>

          <View style={styles.cardBody}>
            {sortedEvents.length === 0 ? (
              <Text style={styles.subtext}>{t('dayDetail.nothingPlanned')}</Text>
            ) : (
              sortedEvents.map((e) => (
                <TouchableOpacity
                  key={e._id}
                  style={[styles.eventRow, { borderLeftColor: getPersonColor(e.owner?.name) }]}
                  onPress={() => navigation.navigate('EventForm', { date, eventId: e._id })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eventTime}>{e.startTime || t('agenda.allDayShort')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                    <View style={styles.eventMetaRow}>
                      <Text style={styles.eventMeta} numberOfLines={1}>{e.type}</Text>
                      {e.notes ? <Text style={styles.eventMeta} numberOfLines={1}> · {e.notes}</Text> : null}
                    </View>
                    <PersonTag name={e.owner?.name} />
                  </View>
                  {e.reminderEnabled && e.reminderAt && (
                    <View style={styles.reminderPill}>
                      <Ionicons name="notifications-outline" size={11} color={theme.primary} />
                      <Text style={styles.reminderText}>{formatTime(new Date(e.reminderAt))}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('EventForm', { date })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={17} color={theme.primary} />
            <Text style={styles.addButtonText}>{t('nav.activityPlan')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text },
    countBadge: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      backgroundColor: hexToRgba(theme.textSecondary, 0.12),
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    cardBody: { marginTop: 12 },
    subtext: { fontSize: 13, color: theme.textSecondary, paddingVertical: 4 },
    totalBlock: { marginBottom: 4 },
    totalValue: { fontSize: 26, fontWeight: '700', color: theme.text },
    splitRow: {
      flexDirection: 'row',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    splitItem: { flex: 1, alignItems: 'center' },
    splitDivider: { width: 1, backgroundColor: theme.border },
    splitLabel: { fontSize: 11, color: theme.textSecondary },
    splitValue: { fontSize: 14, fontWeight: '700', color: theme.text, marginTop: 2 },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: theme.background,
      borderRadius: 10,
      borderLeftWidth: 3,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    eventTime: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, minWidth: 44, paddingTop: 1 },
    eventTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    eventMetaRow: { flexDirection: 'row', marginTop: 1 },
    eventMeta: { fontSize: 12, color: theme.textSecondary },
    reminderPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    reminderText: { fontSize: 11, fontWeight: '700', color: theme.primary },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 12,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      borderRadius: 12,
      paddingVertical: 12,
    },
    addButtonText: { color: theme.primary, fontSize: 14, fontWeight: '700' },
  });
}
