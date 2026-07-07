import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { formatShortDateTime } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import { getPersonColor } from '../utils/personColor';

const ACTION_ICONS = { login: '🔓', logout: '🔒', create: '➕', update: '✏️', delete: '🗑️' };
const ENTITY_KEYS = {
  auth: 'entity.session',
  expense: 'entity.expense',
  event: 'entity.event',
  pushToken: 'entity.pushToken',
  category: 'entity.category',
  savings: 'entity.savings',
  wishlistCategory: 'entity.wishlistCategory',
  wishlistItem: 'entity.wishlistItem',
  income: 'entity.income',
};

export default function ActivityLogScreen() {
  const { t, language } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/audit-log', { params: { limit: 200 } });
      setLogs(res.data.logs);
    } catch (err) {
      console.log('Failed to load activity log:', err.message);
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

  function formatWhen(dateString) {
    return formatShortDateTime(new Date(dateString), language);
  }

  function describeLog(log) {
    const entity = t(ENTITY_KEYS[log.entityType] || log.entityType);
    if (log.action === 'login') return t('activityLog.loggedIn');
    if (log.action === 'logout') return t('activityLog.loggedOut');
    if (log.action === 'create') return t('activityLog.created', { entity });
    if (log.action === 'update') return t('activityLog.updated', { entity });
    if (log.action === 'delete') return t('activityLog.deleted', { entity });
    return `${log.action} ${entity}`;
  }

  return (
    <Screen title={t('nav.activityHistory')}>
      <FlatList
        style={styles.container}
        data={logs}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('activityLog.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderLeftWidth: 4, borderLeftColor: getPersonColor(item.userName) }]}>
            <Text style={styles.icon}>{ACTION_ICONS[item.action] || '•'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.line}>
                <Text style={[styles.name, { color: getPersonColor(item.userName) }]}>{item.userName}</Text>{' '}
                {describeLog(item)}
              </Text>
              <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.surface },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    icon: { fontSize: 20, marginRight: 12 },
    line: { fontSize: 15, color: theme.text },
    name: { fontWeight: '700', color: theme.text },
    when: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
