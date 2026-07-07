import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';

export default function SavingsScreen({ navigation }) {
  const { t, formatAmount, currency: defaultCurrency } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [summary, setSummary] = useState({ personal: {}, together: {} });
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, entriesRes, usersRes] = await Promise.all([
        client.get('/savings/summary'),
        client.get('/savings'),
        client.get('/auth/users'),
      ]);
      setSummary(summaryRes.data);
      setEntries(entriesRes.data.entries);
      setUsers(usersRes.data.users);
    } catch (err) {
      console.log('Failed to load savings:', err.message);
    }
  }, []);

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

  async function handleDelete(id) {
    Alert.alert(t('common.delete'), t('savings.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await client.delete(`/savings/${id}`);
          load();
        },
      },
    ]);
  }

  // Always show a card for BOTH people, even with zero entries, so it's
  // unambiguous that personal savings are fully visible to each other —
  // an empty card is not the same as a hidden one.
  const togetherCurrencies = Object.keys(summary.together);

  return (
    <Screen title={t('nav.savings')}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>{t('savings.personal')}</Text>
        {users.map((u) => {
          const balances = summary.personal[u.name] || {};
          const currenciesForUser = Object.keys(balances);
          return (
            <View key={u._id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: getPersonColor(u.name) }]}>
              <PersonTag name={u.name} />
              {currenciesForUser.length === 0 ? (
                <Text style={styles.balance}>{formatAmount(0, defaultCurrency)}</Text>
              ) : (
                currenciesForUser.map((currency) => (
                  <Text key={currency} style={styles.balance}>
                    {formatAmount(balances[currency], currency)}
                  </Text>
                ))
              )}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>{t('savings.together')}</Text>
        {togetherCurrencies.length === 0 ? (
          <Text style={styles.emptyText}>{t('savings.noneYet')}</Text>
        ) : (
          <View style={styles.card}>
            {togetherCurrencies.map((currency) => (
              <Text key={currency} style={styles.balance}>
                {formatAmount(summary.together[currency], currency)}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('SavingsForm')}>
          <Text style={styles.addButtonText}>{t('savings.addEntry')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('expenseStats.allExpenses') /* reuse "all X" phrasing */}</Text>
        {entries.map((e) => (
          <TouchableOpacity
            key={e._id}
            style={[styles.entryRow, { borderLeftWidth: 4, borderLeftColor: getPersonColor(e.owner?.name) }]}
            onLongPress={() => handleDelete(e._id)}
            onPress={() => navigation.navigate('SavingsForm', { entry: e })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.entryTitle}>
                {e.direction === 'deposit' ? t('savings.deposit') : t('savings.withdrawal')}
              </Text>
              {e.description ? <Text style={styles.cardSubtext}>{e.description}</Text> : null}
              <PersonTag name={e.owner?.name} />
            </View>
            <Text style={[styles.entryAmount, e.direction === 'withdrawal' && { color: theme.danger }]}>
              {e.direction === 'withdrawal' ? '-' : '+'}
              {formatAmount(e.amount, e.currency)}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.hint}>{t('expenseStats.hint')}</Text>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    heading: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8, color: theme.text },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 8 },
    cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4, color: theme.text },
    balance: { fontSize: 20, fontWeight: '700', color: theme.text },
    cardSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    emptyText: { color: theme.textSecondary, marginBottom: 8 },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginVertical: 16,
    },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginVertical: 16 },
  });
}
