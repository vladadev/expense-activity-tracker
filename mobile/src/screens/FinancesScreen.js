import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';

const SCREEN_WIDTH = Dimensions.get('window').width;

function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function emptyBucket() {
  return { income: 0, expenses: 0, netSavings: 0 };
}

export default function FinancesScreen({ navigation }) {
  const { t, formatAmount } = useSettings();
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [overview, setOverview] = useState({});
  const [perOwner, setPerOwner] = useState({});
  const [partner, setPartner] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [carouselPage, setCarouselPage] = useState(0);

  const load = useCallback(async () => {
    const { from, to } = monthRange(0);
    try {
      const [incomeRes, savingsRes, statsRes, usersRes] = await Promise.all([
        client.get('/income', { params: { from, to } }),
        client.get('/savings', { params: { from, to } }),
        client.get(`/stats/range/${from}/${to}`),
        client.get('/auth/users'),
      ]);

      setIncomeEntries(incomeRes.data.entries);
      setPartner(usersRes.data.users.find((u) => u._id !== user.id) || null);

      // Combine independent sources into a per-currency overview:
      // Remaining = Income - Expenses - (Savings deposits - Savings withdrawals).
      // Nothing is physically transferred — this is a live computed snapshot.
      // Also broken down per owner, since each person's expenses/income/savings
      // entries already carry an owner — no extra backend work needed.
      const byCurrency = {};
      const byOwner = {}; // { [currency]: { [ownerName]: bucket } }

      const ensure = (c) => {
        if (!byCurrency[c]) byCurrency[c] = emptyBucket();
        return byCurrency[c];
      };
      const ensureOwner = (c, name) => {
        if (!name) return emptyBucket();
        if (!byOwner[c]) byOwner[c] = {};
        if (!byOwner[c][name]) byOwner[c][name] = emptyBucket();
        return byOwner[c][name];
      };

      for (const e of incomeRes.data.entries) {
        ensure(e.currency).income += e.amount;
        ensureOwner(e.currency, e.owner?.name).income += e.amount;
      }
      for (const s of savingsRes.data.entries) {
        const delta = s.direction === 'withdrawal' ? -s.amount : s.amount;
        ensure(s.currency).netSavings += delta;
        ensureOwner(s.currency, s.owner?.name).netSavings += delta;
      }
      for (const [currency, summary] of Object.entries(statsRes.data.byCurrency)) {
        ensure(currency).expenses += summary.total;
        for (const [ownerName, ownerBreakdown] of Object.entries(summary.byOwner || {})) {
          ensureOwner(currency, ownerName).expenses += ownerBreakdown.total;
        }
      }

      setOverview(byCurrency);
      setPerOwner(byOwner);
    } catch (err) {
      console.log('Failed to load finances overview:', err.message);
    }
  }, [user.id]);

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

  async function handleDeleteIncome(id) {
    Alert.alert(t('common.delete'), t('finance.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await client.delete(`/income/${id}`);
          load();
        },
      },
    ]);
  }

  const currencies = Object.keys(overview);

  function dataFor(ownerName) {
    if (!ownerName) return {};
    const out = {};
    for (const currency of currencies) {
      out[currency] = perOwner[currency]?.[ownerName] || emptyBucket();
    }
    return out;
  }

  const pages = [
    { key: 'combined', label: t('finance.overviewCombined'), data: overview },
    { key: 'mine', label: t('finance.overviewMine'), data: dataFor(user.name) },
    { key: 'partner', label: partner ? t('finance.overviewPartner', { name: partner.name }) : null, data: dataFor(partner?.name) },
  ].filter((p) => p.key !== 'partner' || partner);

  function onCarouselScroll(e) {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCarouselPage(page);
  }

  return (
    <Screen title={t('nav.finances')} showBack={false}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>{t('finance.overview')}</Text>

        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onCarouselScroll}
            scrollEventThrottle={16}
          >
            {pages.map((page) => (
              <View key={page.key} style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
                {page.label ? <Text style={styles.pageLabel}>{page.label}</Text> : null}
                {currencies.length === 0 ? (
                  <Text style={styles.emptyText}>{t('finance.noneYet')}</Text>
                ) : (
                  currencies.map((currency) => {
                    const { income, expenses, netSavings } = page.data[currency] || emptyBucket();
                    const remaining = income - expenses - netSavings;
                    return (
                      <View key={currency} style={styles.card}>
                        <Text style={styles.currencyHeading}>{currency}</Text>
                        <View style={styles.row}>
                          <Text style={styles.rowLabel}>{t('finance.income')}</Text>
                          <Text style={styles.rowValue}>{formatAmount(income, currency)}</Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.rowLabel}>{t('finance.expenses')}</Text>
                          <Text style={[styles.rowValue, { color: theme.danger }]}>-{formatAmount(expenses, currency)}</Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.rowLabel}>{t('finance.netSavings')}</Text>
                          <Text style={styles.rowValue}>
                            {netSavings >= 0 ? '-' : '+'}
                            {formatAmount(Math.abs(netSavings), currency)}
                          </Text>
                        </View>
                        <View style={[styles.row, styles.remainingRow]}>
                          <Text style={styles.remainingLabel}>{t('finance.remaining')}</Text>
                          <Text style={[styles.remainingValue, { color: remaining >= 0 ? theme.success : theme.danger }]}>
                            {formatAmount(remaining, currency)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            {pages.map((page, i) => (
              <View
                key={page.key}
                style={[styles.dot, { backgroundColor: i === carouselPage ? theme.primary : theme.border }]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.linkCard} onPress={() => navigation.navigate('SavingsHome')}>
          <Text style={styles.linkCardText}>{t('finance.viewSavings')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('finance.incomeSection')}</Text>
        {incomeEntries.length === 0 ? (
          <Text style={styles.emptyText}>{t('finance.noneYet')}</Text>
        ) : (
          incomeEntries.map((e) => (
            <TouchableOpacity
              key={e._id}
              style={[styles.entryRow, { borderLeftWidth: 4, borderLeftColor: getPersonColor(e.owner?.name) }]}
              onLongPress={() => handleDeleteIncome(e._id)}
              onPress={() => navigation.navigate('IncomeForm', { entry: e })}
            >
              <View style={{ flex: 1 }}>
                <PersonTag name={e.owner?.name} />
                {e.description ? <Text style={styles.cardSubtext}>{e.description}</Text> : null}
              </View>
              <Text style={styles.entryAmount}>+{formatAmount(e.amount, e.currency)}</Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('IncomeForm')}>
          <Text style={styles.addButtonText}>{t('finance.addIncome')}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{t('expenseStats.hint')}</Text>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8, color: theme.text },
    pageLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
    currencyHeading: { fontSize: 15, fontWeight: '700', color: theme.primary, marginBottom: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { fontSize: 14, color: theme.textSecondary },
    rowValue: { fontSize: 14, fontWeight: '600', color: theme.text },
    remainingRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
    remainingLabel: { fontSize: 15, fontWeight: '700', color: theme.text },
    remainingValue: { fontSize: 16, fontWeight: '700' },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
    dot: { width: 7, height: 7, borderRadius: 3.5, marginHorizontal: 4 },
    linkCard: {
      backgroundColor: theme.primaryLight,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    linkCardText: { color: theme.primary, fontSize: 15, fontWeight: '600' },
    cardSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    emptyText: { color: theme.textSecondary, marginBottom: 8 },
    entryRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      alignItems: 'center',
    },
    entryTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    entryAmount: { fontSize: 16, fontWeight: '700', color: theme.success },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginVertical: 16,
    },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginVertical: 16 },
  });
}
