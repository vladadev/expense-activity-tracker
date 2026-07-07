import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { formatMonthYear } from '../i18n/dateFormat';

const CATEGORY_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

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

export default function StatsScreen() {
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [monthOffset, setMonthOffset] = useState(0);
  const [byDay, setByDay] = useState({});
  const [byCurrency, setByCurrency] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRange(monthOffset);
    try {
      const res = await client.get(`/stats/range/${from}/${to}`);
      setByDay(res.data.byDay);
      setByCurrency(res.data.byCurrency);
    } catch (err) {
      console.log('Failed to load stats:', err.message);
    } finally {
      setLoading(false);
    }
  }, [monthOffset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const days = Object.keys(byDay).sort();
  const currencies = Object.keys(byCurrency);

  const now = new Date();
  const shownMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);

  return (
    <Screen title={t('nav.stats')} showBack={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.monthNavRow}>
          <TouchableOpacity onPress={() => setMonthOffset((o) => o - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthHeading}>{formatMonthYear(shownMonth, language)}</Text>
          <TouchableOpacity
            onPress={() => setMonthOffset((o) => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={24} color={monthOffset >= 0 ? theme.border : theme.primary} />
          </TouchableOpacity>
        </View>

        {currencies.map((currency) => {
          const summary = byCurrency[currency];
          const recentDays = days.slice(-10);
          const barData = {
            labels: recentDays.map((d) => d.slice(8, 10)),
            datasets: [{ data: recentDays.map((d) => byDay[d][currency]?.total || 0) }],
          };

          const categoryEntries = Object.entries(summary.byCategory);
          const pieData = categoryEntries.map(([name, amount], i) => ({
            name,
            amount,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
            legendFontColor: theme.text,
            legendFontSize: 13,
          }));

          const personalVsTogetherData = [
            { name: t('expenseStats.personal'), amount: summary.personalTotal, color: theme.primary, legendFontColor: theme.text, legendFontSize: 13 },
            { name: t('expenseStats.together'), amount: summary.togetherTotal, color: '#F59E0B', legendFontColor: theme.text, legendFontSize: 13 },
          ].filter((d) => d.amount > 0);

          return (
            <View key={currency} style={{ marginBottom: 28 }}>
              <Text style={styles.currencyHeading}>{currency}</Text>
              <View style={styles.summaryRow}>
                <SummaryBox styles={styles} label={t('expenseStats.total')} value={summary.total} currency={currency} formatAmount={formatAmount} />
                <SummaryBox styles={styles} label={t('expenseStats.personal')} value={summary.personalTotal} currency={currency} formatAmount={formatAmount} />
                <SummaryBox styles={styles} label={t('expenseStats.together')} value={summary.togetherTotal} currency={currency} formatAmount={formatAmount} />
              </View>

              {!loading && recentDays.length > 0 && (
                <BarChart
                  data={barData}
                  width={Dimensions.get('window').width - 32}
                  height={200}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: theme.surface,
                    backgroundGradientFrom: theme.surface,
                    backgroundGradientTo: theme.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => hexToRgba(theme.primary, opacity),
                    labelColor: () => theme.text,
                  }}
                  style={styles.chart}
                />
              )}

              {pieData.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionTitle}>{t('stats.categoryBreakdown')}</Text>
                  <PieChart
                    data={pieData}
                    width={Dimensions.get('window').width - 32}
                    height={180}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="8"
                    chartConfig={{ color: () => theme.text }}
                  />
                </View>
              )}

              {personalVsTogetherData.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionTitle}>{t('stats.personalVsTogether')}</Text>
                  <PieChart
                    data={personalVsTogetherData}
                    width={Dimensions.get('window').width - 32}
                    height={180}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="8"
                    chartConfig={{ color: () => theme.text }}
                  />
                </View>
              )}
            </View>
          );
        })}

        {!loading && days.length === 0 && <Text style={styles.emptyText}>{t('stats.noneYet')}</Text>}
      </ScrollView>
    </Screen>
  );
}

function SummaryBox({ label, value, currency, formatAmount, styles }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryValue}>{formatAmount(value, currency)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    heading: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: theme.text },
    monthNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    monthHeading: { fontSize: 17, fontWeight: '700', color: theme.text },
    currencyHeading: { fontSize: 15, fontWeight: '700', color: theme.primary, marginBottom: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    summaryBox: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginHorizontal: 4,
      alignItems: 'center',
    },
    summaryValue: { fontSize: 15, fontWeight: '700', color: theme.text },
    summaryLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    chart: { borderRadius: 12 },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 20 },
  });
}
