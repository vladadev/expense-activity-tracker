import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import client from '../api/client';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';

export default function WishlistItemFormScreen({ route, navigation }) {
  const { folder, item } = route.params;
  const isEditing = !!item;
  // To-Do tasks don't have prices or shop links — only a title and notes.
  const isTodo = folder.scope === 'todo';
  const { t, currency: defaultCurrency } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [title, setTitle] = useState(item?.title || '');
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '');
  const [currency, setCurrency] = useState(item?.currency || defaultCurrency);
  const [link, setLink] = useState(item?.link || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert(t('eventForm.missingTitleTitle'), t('eventForm.missingTitleMessage'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category: folder._id,
        title: title.trim(),
        price: price ? parseFloat(price) : null,
        currency: price ? currency : null,
        link,
        notes,
      };
      if (isEditing) {
        await client.put(`/wishlist/items/${item._id}`, payload);
      } else {
        await client.post('/wishlist/items', payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('expenseForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title={isEditing ? t('expenseForm.saveChanges') : t(isTodo ? 'todo.addItem' : 'wishlist.addItem')}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('wishlist.itemTitle')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t(isTodo ? 'todo.itemTitlePlaceholder' : 'wishlist.itemTitlePlaceholder')}
        placeholderTextColor={theme.textSecondary}
        value={title}
        onChangeText={setTitle}
      />

      {!isTodo && (
        <>
          <Text style={styles.label}>{t('wishlist.price')}</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />

          {!!price && (
            <View style={styles.chipRow}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]} onPress={() => setCurrency(c)}>
                  <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>{t('wishlist.link')}</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
            value={link}
            onChangeText={setLink}
          />
        </>
      )}

      <Text style={styles.label}>{t('wishlist.notes')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('eventForm.notesPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={submitting}>
        <Text style={styles.saveButtonText}>
          {submitting ? t('expenseForm.saving') : isEditing ? t('expenseForm.saveChanges') : t('common.add')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginTop: 16, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: theme.surface,
    },
    chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { color: theme.text, fontSize: 14 },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginTop: 28,
      marginBottom: 40,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
