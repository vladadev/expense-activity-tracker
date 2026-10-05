import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useWishlistItems } from '../context/WishlistItemsContext';
import { useTheme } from '../context/ThemeContext';
import { formatShortDateTime } from '../i18n/dateFormat';
import FormScreen from '../components/form/FormScreen';
import Field from '../components/form/Field';
import TextField from '../components/form/TextField';
import ChipGroup from '../components/form/ChipGroup';
import SwitchRow from '../components/form/SwitchRow';
import useFormSubmit from '../components/form/useFormSubmit';
import { space, radius, type, HIT } from '../theme/scale';

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
  const titleRef = useRef(null);

  // addItem and updateItem apply the change to the list before the request and
  // revert it only if the write was NOT queued — see the offline-write notes.
  const run = useCallback(async () => {
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
    if (isEditing) await updateItem(item._id, payload);
    else await addItem(payload);
  }, [folder, title, price, currency, link, notes, reminderEnabled, reminderAt, isEditing, item, addItem, updateItem]);

  const { submitting, submit } = useFormSubmit({
    run,
    success: isEditing ? t('toast.itemSaved') : t('toast.itemAdded'),
    navigation,
    errorMessage: t('expenseForm.saveError'),
  });

  function handleSave() {
    if (!title.trim()) {
      setTitleError(t('validation.titleRequired'));
      titleRef.current?.focus();
      return;
    }
    setTitleError('');
    submit();
  }

  return (
    <FormScreen
      title={isEditing ? t('expenseForm.saveChanges') : t(isTodo ? 'todo.addItem' : 'wishlist.addItem')}
      onSave={handleSave}
      submitting={submitting}
      saveLabel={isEditing ? t('expenseForm.saveChanges') : t('common.add')}
      savingLabel={t('expenseForm.saving')}
    >
      <TextField
        ref={titleRef}
        label={t('wishlist.itemTitle')}
        placeholder={t('wishlist.itemTitlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        onClearError={() => titleError && setTitleError('')}
        error={titleError}
        returnKeyType="next"
      />

      {/* A task has no price and nowhere to buy it. */}
      {!isTodo && (
        <>
          <TextField
            label={t('wishlist.price')}
            placeholder="0"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />

          {/* Only once there is a price: a currency chosen for nothing is a
              choice the form asked for and will throw away. */}
          {!!price && (
            <ChipGroup
              label={t('expenseForm.currency')}
              options={CURRENCIES}
              value={currency}
              onPick={setCurrency}
            />
          )}

          <TextField
            label={t('wishlist.link')}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={link}
            onChangeText={setLink}
          />
        </>
      )}

      <TextField
        label={t('wishlist.notes')}
        placeholder={t('eventForm.notesPlaceholder')}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <SwitchRow label={t('eventForm.reminder')} value={reminderEnabled} onValueChange={setReminderEnabled} />

      {reminderEnabled && (
        <Field>
          <Pressable
            style={styles.reminderRow}
            onPress={() => setPickerStep(Platform.OS === 'ios' ? 'datetime' : 'date')}
            accessibilityRole="button"
          >
            <Ionicons name="alarm-outline" size={19} color={theme.textSecondary} />
            <Text style={styles.reminderText}>{formatShortDateTime(reminderAt, language)}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        </Field>
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
              // Keep the time-of-day already chosen, swap only the date part.
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
    </FormScreen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm + 4,
      minHeight: HIT,
      paddingHorizontal: space.sm + 4,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    reminderText: { flex: 1, ...type.body, color: theme.text },
  });
}
