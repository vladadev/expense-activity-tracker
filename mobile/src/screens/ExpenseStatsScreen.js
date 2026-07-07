import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';

const CATEGORY_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

export default function ExpenseStatsScreen({ route, navigation }) {
  const { date } = route.params;
  const { t, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [byCurrency, setByCurrency] = useState(null);
  const [expenses, setExpenses] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await client.get(`/stats/${date}`);
      setByCurrency(res.data.byCurrency);
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

  if (!byCurrency) {
    return (
      <Screen title={t('nav.expenses')}>
        <View style={styles.container}>
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </Screen>
    );
  }

  const currencies = Object.keys(byCurrency);

  return (
    <Screen title={t('nav.expenses')}>
    <ScrollView style={styles.container}>
      {currencies.map((currency) => {
        const summary = byCurrency[currency];
        const categoryEntries = Object.entries(summary.byCategory);
        const pieData = categoryEntries.map(([name, amount], i) => ({
          name,
          amount,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          legendFontColor: theme.text,
          legendFontSize: 13,
        }));

        return (
          <View key={currency} style={styles.currencySection}>
            <Text style={styles.currencyHeading}>{currency}</Text>
            <View style={styles.summaryRow}>
              <SummaryBox styles={styles} label={t('expenseStats.total')} value={summary.total} currency={currency} formatAmount={formatAmount} />
              <SummaryBox styles={styles} label={t('expenseStats.personal')} value={summary.personalTotal} currency={currency} formatAmount={formatAmount} />
              <SummaryBox styles={styles} label={t('expenseStats.together')} value={summary.togetherTotal} currency={currency} formatAmount={formatAmount} />
            </View>

            {pieData.length > 0 && (
              <PieChart
                data={pieData}
                width={Dimensions.get('window').width - 32}
                height={200}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="8"
                chartConfig={{ color: () => theme.text }}
              />
            )}

            <Text style={styles.sectionTitle}>{t('expenseStats.byPerson')}</Text>
            {Object.entries(summary.byOwner).map(([name, breakdown]) => (
              <View key={name} style={styles.ownerCard}>
                <Text style={styles.ownerName}>{name}</Text>
                <Text style={styles.cardSubtext}>
                  {t('expenseStats.total')}: {formatAmount(breakdown.total, currency)} · {t('expenseStats.personal')}:{' '}
                  {formatAmount(breakdown.personal, currency)} · {t('expenseStats.together')}:{' '}
                  {formatAmount(breakdown.together, currency)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>{t('expenseStats.allExpenses')}</Text>
      {expenses.length === 0 ? (
        <Text style={styles.emptyText}>{t('expenseStats.noneYet')}</Text>
      ) : (
        expenses.map((e) => (
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
      <Text style={styles.hint}>{t('expenseStats.hint')}</Text>
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
    container: { flex: 1, backgroundColor: theme.background, padding: 16 },
    currencySection: { marginBottom: 12 },
    currencyHeading: { fontSize: 15, fontWeight: '700', color: theme.primary, marginBottom: 8 },
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
    sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8, color: theme.text },
    ownerCard: { backgroundColor: theme.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
    ownerName: { fontSize: 15, fontWeight: '600', color: theme.text },
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
