import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import DonutChart from '../components/DonutChart';
import DayBarChart from '../components/DayBarChart';
import { formatMonthYear } from '../i18n/dateFormat';
import { getPersonColor } from '../utils/personColor';

const CATEGORY_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
const CURRENCY_ORDER = ['RSD', 'EUR', 'USD'];

const MONTHS_SHORT = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sr: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
};

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function yearRange(offset = 0) {
  const year = new Date().getFullYear() + offset;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// Builds the same summary shape the server returns for a currency bucket,
// from a raw expense list — used so person-filtered views can be computed
// entirely on the client.
function computeSummary(list) {
  const s = {
    total: 0,
    personalTotal: 0,
    togetherTotal: 0,
    byCategory: {},
    byCategoryPersonal: {},
    byCategoryTogether: {},
    byOwner: {},
  };
  for (const e of list) {
    s.total += e.amount;
    if (e.type === 'personal') s.personalTotal += e.amount;
    else s.togetherTotal += e.amount;
    s.byCategory[e.category] = (s.byCategory[e.category] || 0) + e.amount;
    const typeCats = e.type === 'personal' ? s.byCategoryPersonal : s.byCategoryTogether;
    typeCats[e.category] = (typeCats[e.category] || 0) + e.amount;
    const name = e.owner?.name || '?';
    if (!s.byOwner[name]) s.byOwner[name] = { total: 0, personal: 0, together: 0 };
    s.byOwner[name].total += e.amount;
    s.byOwner[name][e.type] += e.amount;
  }
  return s;
}

export default function StatsScreen({ navigation }) {
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [periodMode, setPeriodMode] = useState('month'); // 'month' | 'year'
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [byDay, setByDay] = useState({});
  const [byCurrency, setByCurrency] = useState({});
  // Raw expenses from the range endpoint; null while the deployed backend
  // predates the field (person filtering is hidden in that case).
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  // typeFilter: 'all' | 'personal' | 'together'; personFilter: 'all' | owner name.
  const [typeFilter, setTypeFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const fade = useRef(new Animated.Value(1)).current;

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

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = periodMode === 'month' ? monthRange(monthOffset) : yearRange(yearOffset);
    try {
      const res = await client.get(`/stats/range/${from}/${to}`);
      setByDay(res.data.byDay);
      setByCurrency(res.data.byCurrency);
      setExpenses(res.data.expenses || null);
    } catch (err) {
      console.log('Failed to load stats:', err.message);
    } finally {
      setLoading(false);
    }
  }, [periodMode, monthOffset, yearOffset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = new Date();
  const shownYear = now.getFullYear() + yearOffset;
  const shownMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentOffset = periodMode === 'month' ? monthOffset : yearOffset;
  const setCurrentOffset = periodMode === 'month' ? setMonthOffset : setYearOffset;
  const heading =
    periodMode === 'month' ? formatMonthYear(shownMonth, language) : language === 'sr' ? `${shownYear}.` : `${shownYear}`;

  const typeFilterLabel =
    typeFilter === 'personal'
      ? t('expenseStats.personal')
      : typeFilter === 'together'
        ? t('expenseStats.together')
        : t('expenseStats.total');

  // Distinct owners for the person chips (only when raw expenses are available).
  const persons = expenses ? [...new Set(expenses.map((e) => e.owner?.name).filter(Boolean))].sort() : [];
  const personExpenses =
    expenses && personFilter !== 'all' ? expenses.filter((e) => e.owner?.name === personFilter) : expenses;

  // Currency sections: computed client-side when raw expenses exist, otherwise
  // straight from the server aggregates (old backend fallback).
  let currencySections;
  if (personExpenses) {
    const grouped = {};
    for (const e of personExpenses) {
      if (!grouped[e.currency]) grouped[e.currency] = [];
      grouped[e.currency].push(e);
    }
    currencySections = Object.keys(grouped)
      .sort((a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b))
      .map((currency) => ({ currency, summary: computeSummary(grouped[currency]), list: grouped[currency] }));
  } else {
    currencySections = Object.keys(byCurrency).map((currency) => ({
      currency,
      summary: byCurrency[currency],
      list: null,
    }));
  }

  const days = Object.keys(byDay).sort();
  const hasData = personExpenses ? personExpenses.length > 0 : days.length > 0;

  function barDataFor(section) {
    const { currency, list } = section;
    const dayKey = typeFilter === 'all' ? 'total' : typeFilter;

    if (periodMode === 'year') {
      const monthTotals = Array(12).fill(0);
      if (list) {
        for (const e of list) {
          if (typeFilter !== 'all' && e.type !== typeFilter) continue;
          monthTotals[parseInt(e.date.slice(5, 7), 10) - 1] += e.amount;
        }
      } else {
        for (const d of days) {
          monthTotals[parseInt(d.slice(5, 7), 10) - 1] += byDay[d][currency]?.[dayKey] || 0;
        }
      }
      const labels = MONTHS_SHORT[language] || MONTHS_SHORT.en;
      return monthTotals.map((value, i) => ({ label: labels[i], value, date: i }));
    }

    if (list) {
      const dayTotals = {};
      for (const e of list) {
        if (typeFilter !== 'all' && e.type !== typeFilter) continue;
        const day = e.date.slice(0, 10);
        dayTotals[day] = (dayTotals[day] || 0) + e.amount;
      }
      return Object.keys(dayTotals)
        .sort()
        .slice(-10)
        .map((d) => ({ label: d.slice(8, 10), value: dayTotals[d], date: d }));
    }

    return days.slice(-10).map((d) => ({
      label: d.slice(8, 10),
      value: byDay[d][currency]?.[dayKey] || 0,
      date: d,
    }));
  }

  function handleBarPress(date) {
    if (periodMode === 'month') {
      navigation.navigate('ExpenseStats', { date, person: personFilter !== 'all' ? personFilter : undefined });
      return;
    }
    // Year view: a bar is a month — drill into that month's view.
    const target = new Date(shownYear, date, 1);
    const offset = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    if (offset > 0) return;
    setMonthOffset(offset);
    setPeriodMode('month');
    animateContent();
  }

  return (
    <Screen title={t('nav.stats')} showBack={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.segmentRow}>
          {[
            { key: 'month', label: t('stats.monthly') },
            { key: 'year', label: t('stats.yearly') },
          ].map((seg) => (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, periodMode === seg.key && { backgroundColor: theme.primary }]}
              onPress={() => {
                if (periodMode !== seg.key) {
                  setPeriodMode(seg.key);
                  animateContent();
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, periodMode === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.monthNavRow}>
          <TouchableOpacity onPress={() => setCurrentOffset((o) => o - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthHeading}>{heading}</Text>
          <TouchableOpacity
            onPress={() => setCurrentOffset((o) => Math.min(o + 1, 0))}
            disabled={currentOffset >= 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={24} color={currentOffset >= 0 ? theme.border : theme.primary} />
          </TouchableOpacity>
        </View>

        {expenses !== null && persons.length > 0 && (
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

        {currencySections.map((section) => {
          const { currency, summary } = section;
          const barData = barDataFor(section);
          const hasBars = barData.some((d) => d.value > 0);

          // Older backend responses don't have the per-type category split;
          // fall back to the unfiltered rollup until the API is redeployed.
          const typeCategories =
            typeFilter === 'personal' ? summary.byCategoryPersonal : typeFilter === 'together' ? summary.byCategoryTogether : null;
          const categorySource = typeFilter !== 'all' && typeCategories ? typeCategories : summary.byCategory;
          const filteredTotal =
            typeFilter !== 'all' && typeCategories
              ? typeFilter === 'personal'
                ? summary.personalTotal
                : summary.togetherTotal
              : summary.total;

          const categoryEntries = Object.entries(categorySource).sort((a, b) => b[1] - a[1]);
          const pieData = categoryEntries.map(([name, amount], i) => ({
            name,
            amount,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
            valueLabel: formatAmount(amount, currency),
          }));

          const personalVsTogetherData = [
            { name: t('expenseStats.personal'), amount: summary.personalTotal, color: theme.primary },
            { name: t('expenseStats.together'), amount: summary.togetherTotal, color: '#F59E0B' },
          ]
            .filter((d) => d.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .map((d) => ({ ...d, valueLabel: formatAmount(d.amount, currency) }));

          const owners = Object.entries(summary.byOwner || {});

          return (
            <View key={currency} style={{ marginBottom: 28 }}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>{currency}</Text>
              </View>
              <View style={styles.summaryRow}>
                <SummaryBox
                  styles={styles}
                  theme={theme}
                  label={t('expenseStats.total')}
                  value={summary.total}
                  currency={currency}
                  formatAmount={formatAmount}
                  active={typeFilter === 'all'}
                  onPress={() => changeTypeFilter('all')}
                />
                <SummaryBox
                  styles={styles}
                  theme={theme}
                  label={t('expenseStats.personal')}
                  value={summary.personalTotal}
                  currency={currency}
                  formatAmount={formatAmount}
                  active={typeFilter === 'personal'}
                  onPress={() => changeTypeFilter('personal')}
                />
                <SummaryBox
                  styles={styles}
                  theme={theme}
                  label={t('expenseStats.together')}
                  value={summary.togetherTotal}
                  currency={currency}
                  formatAmount={formatAmount}
                  active={typeFilter === 'together'}
                  onPress={() => changeTypeFilter('together')}
                />
              </View>

              <Animated.View style={{ opacity: fade }}>
                {!loading && hasBars && (
                  <View style={styles.chartCard}>
                    <DayBarChart
                      data={barData}
                      width={Dimensions.get('window').width - 64}
                      theme={theme}
                      formatAmount={formatAmount}
                      currency={currency}
                      onBarPress={handleBarPress}
                    />
                  </View>
                )}

                {pieData.length > 0 && (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionTitle}>
                      {t('stats.categoryBreakdown')}
                      {typeFilter !== 'all' ? ` · ${typeFilterLabel}` : ''}
                    </Text>
                    <DonutChart
                      data={pieData}
                      total={filteredTotal}
                      centerCaption={typeFilterLabel}
                      centerValue={formatAmount(filteredTotal, currency)}
                      theme={theme}
                    />
                  </View>
                )}

                {typeFilter === 'all' && personalVsTogetherData.length > 0 && (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionTitle}>{t('stats.personalVsTogether')}</Text>
                    <DonutChart
                      data={personalVsTogetherData}
                      total={summary.personalTotal + summary.togetherTotal}
                      centerCaption={t('expenseStats.total')}
                      centerValue={formatAmount(summary.personalTotal + summary.togetherTotal, currency)}
                      theme={theme}
                    />
                  </View>
                )}

                {personFilter === 'all' && owners.length > 0 && (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionTitle}>{t('stats.byPerson')}</Text>
                    {owners.map(([name, breakdown]) => {
                      const color = getPersonColor(name);
                      return (
                        <View key={name} style={[styles.ownerCard, { borderLeftColor: color }]}>
                          <View style={styles.ownerHeader}>
                            <View style={[styles.ownerDot, { backgroundColor: color }]} />
                            <Text style={styles.ownerName}>{name}</Text>
                            <Text style={styles.ownerTotal}>{formatAmount(breakdown.total, currency)}</Text>
                          </View>
                          <View style={styles.ownerBreakdownRow}>
                            <View style={styles.ownerBreakdownCol}>
                              <Text style={styles.ownerBreakdownLabel}>{t('expenseStats.personal')}</Text>
                              <Text style={styles.ownerBreakdownValue}>{formatAmount(breakdown.personal, currency)}</Text>
                            </View>
                            <View style={styles.ownerBreakdownDivider} />
                            <View style={styles.ownerBreakdownCol}>
                              <Text style={styles.ownerBreakdownLabel}>{t('stats.toTogether')}</Text>
                              <Text style={styles.ownerBreakdownValue}>{formatAmount(breakdown.together, currency)}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            </View>
          );
        })}

        {!loading && !hasData && <Text style={styles.emptyText}>{t('stats.noneYet')}</Text>}
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
    container: { flex: 1, backgroundColor: theme.background },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 3,
      marginBottom: 14,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    segmentTextActive: { color: '#fff' },
    monthNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    monthHeading: { fontSize: 17, fontWeight: '700', color: theme.text },
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
    currencyBadge: {
      alignSelf: 'flex-start',
      backgroundColor: hexToRgba(theme.primary, 0.14),
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 12,
      marginBottom: 16,
    },
    currencyBadgeText: { fontSize: 13, fontWeight: '700', color: theme.primary },
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
    chartCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    ownerCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderLeftWidth: 4,
      padding: 12,
      marginBottom: 10,
    },
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
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 20 },
  });
}
