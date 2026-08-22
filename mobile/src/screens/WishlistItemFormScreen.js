import React, { useMemo, useRef, useState  } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useWishlistItems } from '../context/WishlistItemsContext';
import { useTheme } from '../context/ThemeContext';
import { formatShortDateTime } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import FormError from '../components/FormError';

export default function WishlistItemFormScreen({ route, navigation }) {
  const { folder, item } = route.params;
  const isEditing = !!item;
  // To-Do tasks don't have prices or shop links — only a title and notes.
  const isTodo = folder.scope === 'todo';
  const { t, language, currency: defaultCurrency } = useSettings();
  const { addItem, updateItem } = useWishlistItems();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [title, setTitle] = useState(item?.title || '');
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '');
  const [currency, setCurrency] = useState(item?.currency || defaultCurrency);
  const [link, setLink] = useState(item?.link || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [reminderEnabled, setReminderEnabled] = useState(!!item?.reminderEnabled);
  const [reminderAt, setReminderAt] = useState(() => {
    if (item?.reminderAt) return new Date(item.reminderAt);
    const soon = new Date();
    soon.setHours(soon.getHours() + 1, 0, 0, 0);
    return soon;
  });
  // Android has no combined date+time picker — show date, then time.
  const [pickerStep, setPickerStep] = useState(null); // null | 'date' | 'time' | 'datetime'
  const [titleError, setTitleError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef(null);

  async function handleSave() {
    if (!title.trim()) {
      setTitleError(t('validation.titleRequired'));
      titleRef.current?.focus();
      return;
    }
    setTitleError('');
    setFormError('');

    setSubmitting(true);
    try {
      const payload = {
        category: folder._id,
        title: title.trim(),
        price: price ? parseFloat(price) : null,
        currency: price ? currency : null,
        link,
        notes,
        reminderEnabled,
        reminderAt: reminderEnabled ? reminderAt.toISOString() : null,
      };
      if (isEditing) {
        await updateItem(item._id, payload);
      } else {
        await addItem(payload);
      }
      navigation.goBack();
    } catch (err) {
      setFormError(err.response?.data?.error || t('expenseForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title={isEditing ? t('expenseForm.saveChanges') : t(isTodo ? 'todo.addItem' : 'wishlist.addItem')}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('wishlist.itemTitle')}</Text>
      <TextInput
        ref={titleRef}
        style={[styles.input, !!titleError && styles.inputError]}
        placeholder={t(isTodo ? 'todo.itemTitlePlaceholder' : 'wishlist.itemTitlePlaceholder')}
        placeholderTextColor={theme.textSecondary}
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (titleError) setTitleError('');
        }}
      />
      <FormError message={titleError} />

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

      <View style={styles.reminderRow}>
        <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>{t('eventForm.reminder')}</Text>
        <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
      </View>

      {reminderEnabled && (
        <TouchableOpacity
          style={styles.input}
          onPress={() => setPickerStep(Platform.OS === 'ios' ? 'datetime' : 'date')}
        >
          <Text style={{ color: theme.text }}>{formatShortDateTime(reminderAt, language)}</Text>
        </TouchableOpacity>
      )}

      {pickerStep && (
        <DateTimePicker
          value={reminderAt}
          mode={pickerStep === 'datetime' ? 'datetime' : pickerStep}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            if (Platform.OS === 'android' && event.type === 'dismissed') {
              setPickerStep(null);
              return;
            }
            if (!selected) {
              setPickerStep(null);
              return;
            }
            if (pickerStep === 'date') {
              // Keep the previously chosen time-of-day, just swap the date part.
              const next = new Date(reminderAt);
              next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              setReminderAt(next);
              setPickerStep('time');
            } else {
              setReminderAt(selected);
              setPickerStep(null);
            }
          }}
        />
      )}

      <FormError message={formError} style={{ marginTop: 20 }} />

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
    inputError: { borderColor: theme.danger, borderWidth: 1.5 },
    reminderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 8,
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
