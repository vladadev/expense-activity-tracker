import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { getPersonColor } from '../utils/personColor';

export default function WishlistFolderScreen({ route, navigation }) {
  const { folder } = route.params;
  const { t, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/wishlist/items', { params: { category: folder._id } });
      setItems(res.data.items);
    } catch (err) {
      console.log('Failed to load wishlist items:', err.message);
    }
  }, [folder._id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function togglePurchased(item) {
    await client.put(`/wishlist/items/${item._id}`, { purchased: !item.purchased });
    load();
  }

  function handleDelete(item) {
    Alert.alert(t('common.delete'), t('wishlist.deleteItemConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await client.delete(`/wishlist/items/${item._id}`);
          load();
        },
      },
    ]);
  }

  return (
    <Screen title={folder.name}>
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('wishlist.emptyFolder')}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, { borderLeftWidth: 4, borderLeftColor: getPersonColor(item.addedBy?.name) }]}
            onPress={() => navigation.navigate('WishlistItemForm', { folder, item })}
            onLongPress={() => handleDelete(item)}
          >
            <TouchableOpacity onPress={() => togglePurchased(item)} style={styles.checkbox}>
              <Text style={{ fontSize: 18 }}>{item.purchased ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, item.purchased && styles.itemTitlePurchased]}>{item.title}</Text>
              {item.price != null && (
                <Text style={styles.cardSubtext}>{formatAmount(item.price, item.currency)}</Text>
              )}
              {item.notes ? <Text style={styles.cardSubtext}>{item.notes}</Text> : null}
              {item.link ? (
                <Text style={styles.link} onPress={() => Linking.openURL(item.link)}>
                  {item.link}
                </Text>
              ) : null}
              <Text style={[styles.addedBy, { color: getPersonColor(item.addedBy?.name), fontWeight: '700' }]}>
                {t('wishlist.addedBy', { name: item.addedBy?.name || '' })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('WishlistItemForm', { folder })}
      >
        <Text style={styles.addButtonText}>{t('wishlist.addItem')}</Text>
      </TouchableOpacity>
    </View>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    itemCard: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      alignItems: 'flex-start',
    },
    checkbox: { marginRight: 12, paddingTop: 2 },
    itemTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    itemTitlePurchased: { textDecorationLine: 'line-through', color: theme.textSecondary },
    cardSubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    link: { fontSize: 13, color: theme.primary, marginTop: 2 },
    addedBy: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      margin: 16,
    },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
