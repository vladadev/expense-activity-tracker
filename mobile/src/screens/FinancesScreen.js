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

function emptyBucket() {
  return { income: 0, expenses: 0, netSavings: 0 };
}

export default function FinancesScreen({ navigation }) {
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(theme);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [overview, setOverview] = useState({});
  const [perOwner, setPerOwner] = useState({});
  const [partner, setPartner] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // 'combined' | 'mine' | 'partner' — which slice of the household the
  // overview shows. Visible tabs instead of a swipe carousel so first-time
  // users can actually discover the per-person views.
  const [viewTab, setViewTab] = useState('combined');
  const fade = useRef(new Animated.Value(1)).current;

  function changeTab(next) {
    if (next === viewTab) return;
    setViewTab(next);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

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
  const myColor = getPersonColor(user.name);
  const partnerColor = partner ? getPersonColor(partner.name) : theme.primary;

  const activeName = viewTab === 'mine' ? user.name : viewTab === 'partner' ? partner?.name : null;
  const activeData = activeName
    ? Object.fromEntries(currencies.map((c) => [c, perOwner[c]?.[activeName] || emptyBucket()]))
    : overview;

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

        <Animated.View style={{ opacity: fade }}>
          {currencies.length === 0 ? (
            <Text style={styles.emptyText}>{t('finance.noneYet')}</Text>
          ) : (
            currencies.map((currency) => {
              const { income, expenses, netSavings } = activeData[currency] || emptyBucket();
              const remaining = income - expenses - netSavings;
              return (
                <View key={currency} style={{ marginBottom: 16 }}>
                  <View style={styles.heroCard}>
                    <View style={styles.heroHeader}>
                      <Text style={styles.heroLabel}>{t('finance.remainingThisMonth')}</Text>
                      <View style={styles.currencyBadge}>
                        <Text style={styles.currencyBadgeText}>{currency}</Text>
                      </View>
                    </View>
                    <Text style={[styles.heroValue, { color: remaining >= 0 ? theme.success : theme.danger }]}>
                      {formatAmount(remaining, currency)}
                    </Text>
                    <Text style={styles.heroMonth}>{formatMonthYear(new Date(), language)}</Text>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Ionicons name="arrow-down-outline" size={16} color={theme.success} />
                      <Text style={styles.metricLabel}>{t('finance.income')}</Text>
                      <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(income, currency)}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Ionicons name="arrow-up-outline" size={16} color={theme.danger} />
                      <Text style={styles.metricLabel}>{t('finance.expenses')}</Text>
                      <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(expenses, currency)}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Ionicons name="wallet-outline" size={16} color={theme.primary} />
                      <Text style={styles.metricLabel}>
                        {netSavings >= 0 ? t('finance.toSavings') : t('finance.fromSavings')}
                      </Text>
                      <Text style={styles.metricValue} numberOfLines={1}>{formatAmount(Math.abs(netSavings), currency)}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>

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
    heroMonth: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
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
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
