import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function WishlistScreen({ navigation }) {
  const { t } = useSettings();
  const { wishlistCategories, addCategory, deleteCategory } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [allItems, setAllItems] = useState([]);

  // All items in one fetch, so each folder card can show its (and its
  // subfolders') item count and purchase progress.
  const loadCounts = useCallback(async () => {
    try {
      const res = await client.get('/wishlist/items');
      setAllItems(res.data.items);
    } catch (err) {
      console.log('Failed to load wishlist items:', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  const rootFolders = wishlistCategories.filter((c) => !c.parent);

  function subtreeIds(folderId) {
    const ids = [folderId];
    let frontier = [folderId];
    while (frontier.length > 0) {
      const children = wishlistCategories.filter((c) => frontier.includes(c.parent)).map((c) => c._id);
      ids.push(...children);
      frontier = children;
    }
    return ids;
  }

  function statsFor(folder) {
    const ids = subtreeIds(folder._id);
    const items = allItems.filter((i) => ids.includes(i.category));
    const purchased = items.filter((i) => i.purchased).length;
    const subCount = wishlistCategories.filter((c) => c.parent === folder._id).length;
    return { total: items.length, purchased, subCount };
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await addCategory('wishlist', newName.trim());
      setNewName('');
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('manageCategories.duplicateError'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteFolder(folder) {
    Alert.alert(t('wishlist.deleteFolderConfirmTitle'), t('wishlist.deleteFolderConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCategory(folder._id, 'wishlist') },
    ]);
  }

  return (
    <Screen title={t('nav.wishlist')} showBack={false}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder={t('wishlist.folderNamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={submitting}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rootFolders}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('wishlist.noneYet')}</Text>}
        renderItem={({ item }) => {
          const { total, purchased, subCount } = statsFor(item);
          const progress = total > 0 ? purchased / total : 0;
          return (
            <TouchableOpacity
              style={styles.folderCard}
              onPress={() => navigation.navigate('WishlistFolder', { folder: item })}
              onLongPress={() => handleDeleteFolder(item)}
              activeOpacity={0.7}
            >
              <View style={styles.folderIconWrap}>
                <Ionicons name="folder-open-outline" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.folderSummary} numberOfLines={1}>
                  {t('wishlist.folderSummary', { total, purchased })}
                  {subCount > 0 ? ` · ${subCount} 📁` : ''}
                </Text>
                {total > 0 && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          );
        }}
      />
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    addRow: { flexDirection: 'row', padding: 16, gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      flex: 1,
      backgroundColor: theme.surface,
      color: theme.text,
    },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    folderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: 12,
    },
    folderIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderName: { fontSize: 15, fontWeight: '700', color: theme.text },
    folderSummary: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: hexToRgba(theme.primary, 0.15),
      overflow: 'hidden',
      marginTop: 8,
    },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: theme.primary },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
