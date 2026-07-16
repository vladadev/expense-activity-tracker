import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';
import { formatMonthYear } from '../i18n/dateFormat';

const CURRENCY_ORDER = ['RSD', 'EUR', 'USD'];

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Format a LOCAL date as YYYY-MM-DD. toISOString() must not be used here —
// it converts to UTC, which for UTC+ timezones shifts the window a day back
// (e.g. "July" would become Jun 30 – Jul 30 and drop entries on Jul 31).
function localDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: localDateString(from), to: localDateString(to) };
}

function emptyBucket() {
  return { income: 0, expenses: 0, netSavings: 0 };
}

// Accumulates income/savings entry lists + an expense stats byCurrency rollup
// into { byCurrency: {cur: bucket}, byOwner: {cur: {name: bucket}} }.
function buildBuckets(incomeList, savingsList, statsByCurrency) {
  const byCurrency = {};
  const byOwner = {};
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

  for (const e of incomeList) {
    ensure(e.currency).income += e.amount;
    ensureOwner(e.currency, e.owner?.name).income += e.amount;
  }
  for (const s of savingsList) {
    const delta = s.direction === 'withdrawal' ? -s.amount : s.amount;
    ensure(s.currency).netSavings += delta;
    ensureOwner(s.currency, s.owner?.name).netSavings += delta;
  }
  for (const [currency, summary] of Object.entries(statsByCurrency)) {
    ensure(currency).expenses += summary.total;
    for (const [ownerName, ownerBreakdown] of Object.entries(summary.byOwner || {})) {
      ensureOwner(currency, ownerName).expenses += ownerBreakdown.total;
    }
  }
  return { byCurrency, byOwner };
}

export default function FinancesScreen({ navigation }) {
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [monthData, setMonthData] = useState({ byCurrency: {}, byOwner: {} });
  const [allData, setAllData] = useState({ byCurrency: {}, byOwner: {} });
  const [partner, setPartner] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('RSD');
  // 'combined' | 'mine' | 'partner' — visible tabs instead of a swipe carousel.
  const [viewTab, setViewTab] = useState('combined');
  const fade = useRef(new Animated.Value(1)).current;

  function animateContent() {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  function changeTab(next) {
    if (next === viewTab) return;
    setViewTab(next);
    animateContent();
  }

  function changeCurrency(next) {
    if (next === selectedCurrency) return;
    setSelectedCurrency(next);
    animateContent();
  }

  const load = useCallback(async () => {
    const { from, to } = monthRange(0);
    const today = localDateString(new Date());
    try {
      // All-time income/savings lists (filtered to the month client-side),
      // plus expense rollups for the month and for all time.
      const [incomeRes, savingsRes, statsMonthRes, statsAllRes, usersRes] = await Promise.all([
        client.get('/income'),
        client.get('/savings'),
        client.get(`/stats/range/${from}/${to}`),
        client.get(`/stats/range/2000-01-01/${today}`),
        client.get('/auth/users'),
      ]);

      setPartner(usersRes.data.users.find((u) => u._id !== user.id) || null);

      const inMonth = (entry) => {
        const d = (entry.date || '').slice(0, 10);
        return d >= from && d <= to;
      };
      const monthIncome = incomeRes.data.entries.filter(inMonth);
      const monthSavings = savingsRes.data.entries.filter(inMonth);

      setIncomeEntries(monthIncome);
      setMonthData(buildBuckets(monthIncome, monthSavings, statsMonthRes.data.byCurrency));
      setAllData(buildBuckets(incomeRes.data.entries, savingsRes.data.entries, statsAllRes.data.byCurrency));
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

  const currencies = [...new Set([...Object.keys(allData.byCurrency), ...Object.keys(monthData.byCurrency)])].sort(
    (a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b)
  );
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0];

  const myColor = getPersonColor(user.name);
  const partnerColor = partner ? getPersonColor(partner.name) : theme.primary;
  const activeName = viewTab === 'mine' ? user.name : viewTab === 'partner' ? partner?.name : null;

  function bucketFor(data) {
    if (!currency) return emptyBucket();
    if (activeName) return data.byOwner[currency]?.[activeName] || emptyBucket();
    return data.byCurrency[currency] || emptyBucket();
  }

  const month = bucketFor(monthData);
  const all = bucketFor(allData);
  const remainingMonth = month.income - month.expenses - month.netSavings;
  const available = all.income - all.expenses - all.netSavings;

  const tabs = [
    { key: 'combined', label: t('finance.tabCombined'), color: theme.primary, dot: false },
    { key: 'mine', label: t('finance.tabMine'), color: myColor, dot: true },
    ...(partner ? [{ key: 'partner', label: partner.name, color: partnerColor, dot: true }] : []),
  ];

  return (
    <Screen title={t('nav.finances')} showBack={false}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.personRow}>
          {tabs.map((tab) => {
            const active = viewTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.personChip, active && { borderColor: tab.color, backgroundColor: hexToRgba(tab.color, 0.12) }]}
                onPress={() => changeTab(tab.key)}
                activeOpacity={0.7}
              >
                {tab.dot && <View style={[styles.personChipDot, { backgroundColor: tab.color }]} />}
                <Text style={[styles.personChipText, active && { color: tab.color, fontWeight: '700' }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {currencies.length === 0 ? (
          <Text style={styles.emptyText}>{t('finance.noneYet')}</Text>
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t('stats.thisMonth')} · {formatMonthYear(new Date(), language)}
              </Text>
              {currencies.length > 1 && (
                <View style={styles.currencyPills}>
                  {currencies.map((c) => {
                    const active = c === currency;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[styles.currencyPill, active && { backgroundColor: theme.primary }]}
                        onPress={() => changeCurrency(c)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.currencyPillText, active && { color: '#fff', fontWeight: '700' }]}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Animated.View style={{ opacity: fade }}>
              <View style={styles.heroCard}>
                <View style={styles.heroHeader}>
                  <Text style={styles.heroLabel}>{t('finance.remainingThisMonth')}</Text>
                  <View style={styles.currencyBadge}>
                    <Text style={styles.currencyBadgeText}>{currency}</Text>
                  </View>
                </View>
                <Text style={[styles.heroValue, { color: remainingMonth >= 0 ? theme.success : theme.danger }]}>
                  {formatAmount(remainingMonth, currency)}
                </Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Ionicons name="arrow-down-outline" size={16} color={theme.success} />
                  <Text style={styles.metricLabel}>{t('finance.income')}</Text>
                  <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(month.income, currency)}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Ionicons name="arrow-up-outline" size={16} color={theme.danger} />
                  <Text style={styles.metricLabel}>{t('finance.expenses')}</Text>
                  <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(month.expenses, currency)}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Ionicons name="wallet-outline" size={16} color={theme.primary} />
                  <Text style={styles.metricLabel}>
                    {month.netSavings >= 0 ? t('finance.toSavings') : t('finance.fromSavings')}
                  </Text>
                  <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(Math.abs(month.netSavings), currency)}</Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('finance.totalState')}</Text>
              <View style={styles.totalsCard}>
                <View style={styles.totalsRow}>
                  <View style={styles.totalsLabelWrap}>
                    <Ionicons name="cash-outline" size={17} color={theme.primary} />
                    <Text style={styles.totalsLabel}>{t('finance.available')}</Text>
                  </View>
                  <Text style={[styles.totalsValue, { color: available >= 0 ? theme.success : theme.danger }]}>
                    {formatAmount(available, currency)}
                  </Text>
                </View>
                <View style={[styles.totalsRow, styles.totalsRowDivider]}>
                  <View style={styles.totalsLabelWrap}>
                    <Ionicons name="wallet-outline" size={17} color={theme.primary} />
                    <Text style={styles.totalsLabel}>{t('finance.totalSavings')}</Text>
                  </View>
                  <Text style={styles.totalsValue}>{formatAmount(all.netSavings, currency)}</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionPrimary} onPress={() => navigation.navigate('IncomeForm')} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.actionPrimaryText}>{t('finance.incomeSection')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation.navigate('SavingsHome')} activeOpacity={0.8}>
            <Ionicons name="wallet-outline" size={18} color={theme.primary} />
            <Text style={styles.actionSecondaryText}>{t('finance.savings')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionWrap}>
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
        </View>
        <Text style={styles.hint}>{t('expenseStats.hint')}</Text>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
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
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    currencyPills: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 3,
      marginBottom: 10,
    },
    currencyPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
    currencyPillText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    heroCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
    },
    heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    heroLabel: { fontSize: 13, color: theme.textSecondary },
    currencyBadge: {
      backgroundColor: hexToRgba(theme.primary, 0.14),
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 10,
    },
    currencyBadgeText: { fontSize: 12, fontWeight: '700', color: theme.primary },
    heroValue: { fontSize: 32, fontWeight: '700' },
    metricsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    metricBox: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    metricLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    metricValue: { fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 2 },
    totalsCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    totalsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    totalsRowDivider: { borderTopWidth: 1, borderTopColor: theme.border },
    totalsLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    totalsLabel: { fontSize: 14, color: theme.textSecondary },
    totalsValue: { fontSize: 16, fontWeight: '700', color: theme.text },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    actionPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 13,
    },
    actionPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    actionSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 13,
      borderWidth: 1.5,
      borderColor: hexToRgba(theme.primary, 0.4),
    },
    actionSecondaryText: { color: theme.primary, fontSize: 14, fontWeight: '600' },
    sectionWrap: {
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
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
    entryAmount: { fontSize: 16, fontWeight: '700', color: theme.success },
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginVertical: 16 },
  });
}
