import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import Screen from '../components/Screen';
import PersonTag from '../components/PersonTag';
import { getPersonColor } from '../utils/personColor';
import { formatShortDateTime } from '../i18n/dateFormat';

const ENTITY_ICONS = { expense: '💰', event: '📅', savings: '🐷', income: '💵', wishlistItem: '🎁' };

export default function NotificationsScreen() {
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { notifications, loadNotifications, markSeen } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      markSeen();
    }, [loadNotifications, markSeen])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }

  function describe(log) {
    const d = log.details || {};
    const label = t(`notif.${log.entityType}.${log.action}`);

    if (log.entityType === 'expense') {
      const src = log.action === 'update' ? d.after || d : d;
      const amountText = src.amount != null ? formatAmount(src.amount, src.currency) : '';
      const extra = src.description || src.category || '';
      return `${label}: ${amountText}${extra ? `, ${extra}` : ''}`;
    }

    if (log.entityType === 'income') {
      const src = log.action === 'update' ? d.after || d : d;
      const amountText = src.amount != null ? formatAmount(src.amount, src.currency) : '';
      const extra = src.description || '';
      return `${label}: ${amountText}${extra ? `, ${extra}` : ''}`;
    }

    if (log.entityType === 'savings') {
      const src = log.action === 'update' ? d.after || d : d;
      const directionText = src.direction === 'withdrawal' ? t('savings.withdrawal') : t('savings.deposit');
      const amountText = src.amount != null ? formatAmount(src.amount, src.currency) : '';
      const extra = src.description || '';
      return `${label}: ${directionText}, ${amountText}${extra ? `, ${extra}` : ''}`;
    }

    if (log.entityType === 'event') {
      const src = log.action === 'update' ? d.after || d : d;
      return `${label}: ${src.title || ''}`;
    }

    if (log.entityType === 'wishlistItem') {
      const src = log.action === 'update' ? d.after || d : d;
      const extra = d.folder ? ` (${d.folder})` : '';
      return `${label}: ${src.title || ''}${extra}`;
    }

    return label;
  }

  function formatWhen(dateString) {
    return formatShortDateTime(new Date(dateString), language);
  }

  return (
    <Screen title={t('nav.notifications')} showBell={false}>
      <FlatList
        style={styles.container}
        data={notifications}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('notif.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderLeftWidth: 4, borderLeftColor: getPersonColor(item.userName) }]}>
            <Text style={styles.icon}>{ENTITY_ICONS[item.entityType] || '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <PersonTag name={item.userName} />
              <Text style={styles.line}>{describe(item)}</Text>
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
    container: { flex: 1, backgroundColor: theme.background },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 12,
    },
    icon: { fontSize: 22, marginRight: 12 },
    line: { fontSize: 14, color: theme.text, marginTop: 4 },
    when: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: theme.textSecondary, textAlign: 'center' },
  });
}
