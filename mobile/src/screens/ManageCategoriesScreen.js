import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';

export default function ManageCategoriesScreen({ route }) {
  const { t } = useSettings();
  const { expenseCategories, eventCategories, addCategory, renameCategory, deleteCategory } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [tab, setTab] = useState(route.params?.initialTab || 'expense');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = tab === 'expense' ? expenseCategories : eventCategories;

  async function handleAdd() {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await addCategory(tab, newName.trim());
      setNewName('');
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('manageCategories.duplicateError'));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(category) {
    setEditingId(category._id);
    setEditingName(category.name);
  }

  async function saveEdit(category) {
    if (!editingName.trim()) return;
    try {
      await renameCategory(category._id, tab, editingName.trim());
      setEditingId(null);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('manageCategories.duplicateError'));
    }
  }

  function handleDelete(category) {
    Alert.alert(t('manageCategories.deleteConfirmTitle'), t('manageCategories.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCategory(category._id, tab) },
    ]);
  }

  return (
    <Screen title={t('nav.manageCategories')}>
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'expense' && styles.tabActive]} onPress={() => setTab('expense')}>
          <Text style={[styles.tabText, tab === 'expense' && styles.tabTextActive]}>{t('manageCategories.expenseTab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'event' && styles.tabActive]} onPress={() => setTab('event')}>
          <Text style={[styles.tabText, tab === 'event' && styles.tabTextActive]}>{t('manageCategories.eventTab')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder={t('manageCategories.namePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={newName}
          onChangeText={setNewName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={submitting}>
          <Text style={styles.addButtonText}>{t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.emptyText}>{t('common.none')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {editingId === item._id ? (
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={editingName}
                onChangeText={setEditingName}
                autoFocus
                onSubmitEditing={() => saveEdit(item)}
              />
            ) : (
              <Text style={styles.rowText}>{item.name}</Text>
            )}
            <View style={styles.rowActions}>
              {editingId === item._id ? (
                <TouchableOpacity onPress={() => saveEdit(item)}>
                  <Text style={styles.actionLink}>{t('common.save')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startEdit(item)}>
                  <Text style={styles.actionLink}>{t('common.rename')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={[styles.actionLink, { color: theme.danger }]}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.surface },
    tabRow: { flexDirection: 'row', padding: 16, paddingBottom: 0 },
    tab: {
      flex: 1,
      padding: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
    },
    tabActive: { borderBottomColor: theme.primary },
    tabText: { color: theme.textSecondary, fontWeight: '600' },
    tabTextActive: { color: theme.primary },
    addRow: { flexDirection: 'row', padding: 16, gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      flex: 1,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 18,
      justifyContent: 'center',
    },
    addButtonText: { color: '#fff', fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowText: { fontSize: 15, flex: 1, color: theme.text },
    rowActions: { flexDirection: 'row', gap: 16 },
    actionLink: { color: theme.primary, fontWeight: '600', marginLeft: 16 },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
