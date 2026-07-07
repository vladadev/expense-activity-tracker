import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';

export default function WishlistScreen({ navigation }) {
  const { t } = useSettings();
  const { wishlistCategories, addCategory, deleteCategory } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={submitting}>
          <Text style={styles.addButtonText}>{t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={wishlistCategories}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('wishlist.noneYet')}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.folderCard}
            onPress={() => navigation.navigate('WishlistFolder', { folder: item })}
            onLongPress={() => handleDeleteFolder(item)}
          >
            <Text style={styles.folderName}>📁 {item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
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
    addButton: { backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
    addButtonText: { color: '#fff', fontWeight: '600' },
    folderCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 8 },
    folderName: { fontSize: 16, fontWeight: '600', color: theme.text },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
