import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import DonutChart from '../components/DonutChart';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';
import { formatLongDate } from '../i18n/dateFormat';

const CATEGORY_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
const CURRENCY_ORDER = ['RSD', 'EUR', 'USD'];

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ExpenseStatsScreen({ route, navigation }) {
  const { date } = route.params;
  const { t, formatAmount, language } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [expenses, setExpenses] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // typeFilter: 'all' | 'personal' | 'together'; personFilter: 'all' | owner name.
  // personFilter can arrive preselected from the Stats screen's person chips.
  const [typeFilter, setTypeFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState(route.params.person || 'all');
  const fade = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      const res = await client.get(`/stats/${date}`);
      setExpenses(res.data.expenses);
    } catch (err) {
      console.log('Failed to load expense stats:', err.message);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function animateContent() {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  function changeTypeFilter(next) {
    const value = typeFilter === next ? 'all' : next;
    if (value === typeFilter) return;
    setTypeFilter(value);
    animateContent();
  }

  function changePersonFilter(next) {
    if (next === personFilter) return;
    setPersonFilter(next);
    animateContent();
  }

  async function handleDelete(id) {
    Alert.alert(t('expenseStats.deleteTitle'), t('expenseStats.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await client.delete(`/expenses/${id}`);
          load();
        },
      },
    ]);
  }

  if (expenses === null) {
    return (
      <Screen title={t('nav.expenses')}>
        <View style={styles.container}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </Screen>
    );
  }

  const persons = [...new Set(expenses.map((e) => e.owner?.name).filter(Boolean))].sort();
  const personExpenses = personFilter === 'all' ? expenses : expenses.filter((e) => e.owner?.name === personFilter);
  const filteredExpenses = typeFilter === 'all' ? personExpenses : personExpenses.filter((e) => e.type === typeFilter);

  const typeFilterLabel =
    typeFilter === 'personal'
      ? t('expenseStats.personal')
      : typeFilter === 'together'
        ? t('expenseStats.together')
        : t('expenseStats.total');

  // Per-currency sections computed from the person-filtered list, so the
  // summary boxes reflect the selected person too.
  const grouped = {};
  for (const e of personExpenses) {
    if (!grouped[e.currency]) grouped[e.currency] = [];
    grouped[e.currency].push(e);
  }
  const currencies = Object.keys(grouped).sort((a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b));

  return (
    <Screen title={t('nav.expenses')}>
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.dateHeader} onPress={() => setShowDatePicker(true)} activeOpacity={0.6}>
        <Ionicons name="calendar-outline" size={18} color={theme.primary} />
        <Text style={styles.dateHeaderText}>{formatLongDate(date, language)}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={new Date(date + 'T00:00:00')}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            setShowDatePicker(false);
            if (selected) {
              const y = selected.getFullYear();
              const m = String(selected.getMonth() + 1).padStart(2, '0');
              const d = String(selected.getDate()).padStart(2, '0');
              navigation.setParams({ date: `${y}-${m}-${d}` });
            }
          }}
        />
      )}

      {persons.length > 0 && (
        <View style={styles.personRow}>
          <TouchableOpacity
            style={[
              styles.personChip,
              personFilter === 'all' && { borderColor: theme.primary, backgroundColor: hexToRgba(theme.primary, 0.12) },
            ]}
            onPress={() => changePersonFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.personChipText, personFilter === 'all' && { color: theme.primary, fontWeight: '700' }]}>
              {t('stats.everyone')}
            </Text>
          </TouchableOpacity>
          {persons.map((name) => {
            const color = getPersonColor(name);
            const active = personFilter === name;
            return (
              <TouchableOpacity
                key={name}
                style={[styles.personChip, active && { borderColor: color, backgroundColor: hexToRgba(color, 0.12) }]}
                onPress={() => changePersonFilter(name)}
                activeOpacity={0.7}
              >
                <View style={[styles.personChipDot, { backgroundColor: color }]} />
                <Text style={[styles.personChipText, active && { color, fontWeight: '700' }]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {currencies.length === 0 && <Text style={styles.emptyText}>{t('expenseStats.noneYet')}</Text>}

      {currencies.map((currency) => {
        const list = grouped[currency];
        let total = 0;
        let personalTotal = 0;
        let togetherTotal = 0;
        for (const e of list) {
          total += e.amount;
          if (e.type === 'personal') personalTotal += e.amount;
          else togetherTotal += e.amount;
        }

        const typeFiltered = typeFilter === 'all' ? list : list.filter((e) => e.type === typeFilter);
        const filteredTotal = typeFiltered.reduce((sum, e) => sum + e.amount, 0);

        const byCategory = {};
        const byOwner = {};
        for (const e of typeFiltered) {
          byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
          const ownerName = e.owner?.name || '?';
          if (!byOwner[ownerName]) byOwner[ownerName] = { total: 0, personal: 0, together: 0 };
          byOwner[ownerName].total += e.amount;
          byOwner[ownerName][e.type] += e.amount;
        }

        const pieData = Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([name, amount], i) => ({
            name,
            amount,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
            valueLabel: formatAmount(amount, currency),
          }));

        return (
          <View key={currency} style={styles.currencySection}>
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyBadgeText}>{currency}</Text>
            </View>
            <View style={styles.summaryRow}>
              <SummaryBox
                styles={styles}
                theme={theme}
                label={t('expenseStats.total')}
                value={total}
                currency={currency}
                formatAmount={formatAmount}
                active={typeFilter === 'all'}
                onPress={() => changeTypeFilter('all')}
              />
              <SummaryBox
                styles={styles}
                theme={theme}
                label={t('expenseStats.personal')}
                value={personalTotal}
                currency={currency}
                formatAmount={formatAmount}
                active={typeFilter === 'personal'}
                onPress={() => changeTypeFilter('personal')}
              />
              <SummaryBox
                styles={styles}
                theme={theme}
                label={t('expenseStats.together')}
                value={togetherTotal}
                currency={currency}
                formatAmount={formatAmount}
                active={typeFilter === 'together'}
                onPress={() => changeTypeFilter('together')}
              />
            </View>

            <Animated.View style={{ opacity: fade }}>
              {pieData.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionTitle}>{t('stats.categoryBreakdown')}</Text>
                  <DonutChart
                    data={pieData}
                    total={filteredTotal}
                    centerCaption={typeFilterLabel}
                    centerValue={formatAmount(filteredTotal, currency)}
                    theme={theme}
                  />
                </View>
              ) : (
                <Text style={styles.emptyText}>{t('expenseStats.noneYet')}</Text>
              )}

              {personFilter === 'all' && Object.keys(byOwner).length > 0 && (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionTitle}>{t('expenseStats.byPerson')}</Text>
                  {Object.entries(byOwner).map(([name, breakdown]) => (
                    <View
                      key={name}
                      style={[styles.ownerCard, { borderLeftWidth: 4, borderLeftColor: getPersonColor(name) }]}
                    >
                      <View style={styles.ownerHeader}>
                        <View style={[styles.ownerDot, { backgroundColor: getPersonColor(name) }]} />
                        <Text style={styles.ownerName}>{name}</Text>
                        <Text style={styles.ownerTotal}>{formatAmount(breakdown.total, currency)}</Text>
                      </View>
                      {typeFilter === 'all' && (
                        <View style={styles.ownerBreakdownRow}>
                          <View style={styles.ownerBreakdownCol}>
                            <Text style={styles.ownerBreakdownLabel}>{t('expenseStats.personal')}</Text>
                            <Text style={styles.ownerBreakdownValue}>{formatAmount(breakdown.personal, currency)}</Text>
                          </View>
                          <View style={styles.ownerBreakdownDivider} />
                          <View style={styles.ownerBreakdownCol}>
                            <Text style={styles.ownerBreakdownLabel}>{t('expenseStats.together')}</Text>
                            <Text style={styles.ownerBreakdownValue}>{formatAmount(breakdown.together, currency)}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          </View>
        );
      })}

      <Animated.View style={{ opacity: fade }}>
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>
            {t('expenseStats.allExpenses')}
            {typeFilter !== 'all' ? ` · ${typeFilterLabel}` : ''}
            {personFilter !== 'all' ? ` · ${personFilter}` : ''}
          </Text>
          {filteredExpenses.length === 0 ? (
            <Text style={styles.emptyText}>{t('expenseStats.noneYet')}</Text>
          ) : (
            filteredExpenses.map((e) => (
              <TouchableOpacity
                key={e._id}
                style={[styles.expenseRow, { borderLeftWidth: 4, borderLeftColor: getPersonColor(e.owner?.name) }]}
                onLongPress={() => handleDelete(e._id)}
                onPress={() => navigation.navigate('ExpenseForm', { date, expense: e })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseCategory}>
                    {e.category} · {e.type === 'personal' ? t('expenseStats.personal') : t('expenseStats.together')}
                  </Text>
                  {e.description ? <Text style={styles.cardSubtext}>{e.description}</Text> : null}
                  <PersonTag name={e.owner?.name} />
                </View>
                <Text style={styles.expenseAmount}>{formatAmount(e.amount, e.currency)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
        <Text style={styles.hint}>{t('expenseStats.hint')}</Text>
      </Animated.View>
    </ScrollView>
    </Screen>
  );
}

function SummaryBox({ label, value, currency, formatAmount, styles, theme, active, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.summaryBox,
        active && { borderColor: theme.primary, backgroundColor: hexToRgba(theme.primary, 0.12) },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.summaryValue, active && { color: theme.primary }]}>{formatAmount(value, currency)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, padding: 16 },
    dateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
      alignSelf: 'flex-start',
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    dateHeaderText: { fontSize: 16, fontWeight: '700', color: theme.text },
    personRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    personChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    personChipDot: { width: 8, height: 8, borderRadius: 4 },
    personChipText: { fontSize: 13, color: theme.textSecondary },
    currencySection: { marginBottom: 12 },
    currencyBadge: {
      alignSelf: 'flex-start',
      backgroundColor: hexToRgba(theme.primary, 0.14),
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 12,
      marginBottom: 16,
    },
    currencyBadgeText: { fontSize: 13, fontWeight: '700', color: theme.primary },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryBox: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginHorizontal: 4,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    summaryValue: { fontSize: 15, fontWeight: '700', color: theme.text },
    summaryLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    sectionWrap: {
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    ownerCard: { backgroundColor: theme.surface, borderRadius: 10, padding: 12, marginBottom: 10 },
    ownerHeader: { flexDirection: 'row', alignItems: 'center' },
    ownerDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    ownerName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
    ownerTotal: { fontSize: 16, fontWeight: '700', color: theme.text },
    ownerBreakdownRow: {
      flexDirection: 'row',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    ownerBreakdownCol: { flex: 1, alignItems: 'center' },
    ownerBreakdownDivider: { width: 1, backgroundColor: theme.border, marginHorizontal: 8 },
    ownerBreakdownLabel: { fontSize: 12, color: theme.textSecondary },
    ownerBreakdownValue: { fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 2 },
    cardSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    expenseRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      alignItems: 'center',
    },
    expenseCategory: { fontSize: 15, fontWeight: '600', color: theme.text },
    expenseAmount: { fontSize: 16, fontWeight: '700', color: theme.text },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 20 },
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginVertical: 16 },
  });
}
