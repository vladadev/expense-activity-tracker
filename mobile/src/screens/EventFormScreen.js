import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { cachedGet } from '../api/cachedGet';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import { useDataEvents } from '../context/DataEventsContext';
import { formatShortDateTime } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import { SkeletonBlock } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import FormScreen from '../components/form/FormScreen';
import Field from '../components/form/Field';
import TextField from '../components/form/TextField';
import ChipGroup from '../components/form/ChipGroup';
import SwitchRow from '../components/form/SwitchRow';
import useFormSubmit from '../components/form/useFormSubmit';
import { space, radius, type, HIT } from '../theme/scale';

export default function EventFormScreen({ route, navigation }) {
  const { date, eventId } = route.params;
  const { t, language } = useSettings();
  const { eventCategories } = useCategories();
  const { theme } = useTheme();
  const toast = useToast();
  const { emit } = useDataEvents();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEditing = !!eventId;

  const [title, setTitle] = useState('');
  const [type, setType] = useState(eventCategories[0]?.name || '');
  const [notes, setNotes] = useState('');
  // startTime is a literal "HH:MM" string, or null for an all-day entry.
  const [startTime, setStartTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [titleError, setTitleError] = useState('');
  const titleRef = useRef(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState(new Date(date + 'T09:00:00'));
  // Android's native picker only supports a single date OR time widget at a
  // time — there's no combined "datetime" mode like on iOS. Passing
  // mode="datetime" on Android crashes, so we show date then time in sequence.
  const [pickerStep, setPickerStep] = useState(null); // null | 'date' | 'time'
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    cachedGet(`/events/${eventId}`).then((res) => {
      const e = res.data.event;
      setTitle(e.title);
      setType(e.type);
      setNotes(e.notes || '');
      setStartTime(e.startTime || null);
      setReminderEnabled(e.reminderEnabled);
      if (e.reminderAt) setReminderAt(new Date(e.reminderAt));
      setLoading(false);
    });
  }, [isEditing, eventId]);

  const run = useCallback(async () => {
    const payload = {
      title: title.trim(),
      type,
      notes,
      date,
      startTime,
      reminderEnabled,
      reminderAt: reminderEnabled ? reminderAt.toISOString() : null,
    };
    if (isEditing) {
      const updated = await client.put(`/events/${eventId}`, payload);
      emit('event', 'update', updated.data.event);
    } else {
      const created = await client.post('/events', payload);
      emit('event', 'create', created.data.event);
    }
  }, [title, type, notes, date, startTime, reminderEnabled, reminderAt, isEditing, eventId, emit]);

  const { submitting, submit } = useFormSubmit({
    run,
    success: isEditing ? t('toast.eventSaved') : t('toast.eventAdded'),
    navigation,
    errorMessage: t('eventForm.saveError'),
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

  function handleDelete() {
    Alert.alert(t('common.delete'), t('eventForm.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await client.delete(`/events/${eventId}`);
          emit('event', 'delete', { _id: eventId });
          toast.success(t('toast.eventDeleted'));
          navigation.goBack();
        },
      },
    ]);
  }

  const screenTitle = isEditing ? t('eventForm.saveChanges') : t('nav.activityPlan');

  if (loading) {
    return (
      <Screen title={screenTitle}>
        <View style={{ padding: space.md }}>
          <SkeletonBlock width={'70%'} height={22} radius={8} y={40} />
        </View>
      </Screen>
    );
  }

  return (
    <FormScreen
      title={screenTitle}
      onSave={handleSave}
      submitting={submitting}
      saveLabel={isEditing ? t('eventForm.saveChanges') : t('eventForm.add')}
      savingLabel={t('eventForm.saving')}
    >
      <TextField
        ref={titleRef}
        label={t('eventForm.titleLabel')}
        placeholder={t('eventForm.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        onClearError={() => titleError && setTitleError('')}
        error={titleError}
        returnKeyType="next"
      />

      {/* All day, or at a time. Two halves of one answer, so they are one
          control rather than a toggle with a field hiding behind it. */}
      <Field label={t('eventForm.time')}>
        <View style={styles.timeRow}>
          <Pressable
            style={[styles.timeOption, !startTime && styles.timeOptionOn]}
            onPress={() => setStartTime(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !startTime }}
          >
            <Ionicons name="sunny-outline" size={16} color={!startTime ? '#fff' : theme.textSecondary} />
            <Text style={[styles.timeText, !startTime && styles.timeTextOn]}>{t('eventForm.allDay')}</Text>
          </Pressable>
          <Pressable
            style={[styles.timeOption, !!startTime && styles.timeOptionOn]}
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
            accessibilityState={{ selected: !!startTime }}
          >
            <Ionicons name="time-outline" size={16} color={startTime ? '#fff' : theme.textSecondary} />
            <Text style={[styles.timeText, !!startTime && styles.timeTextOn]}>
              {startTime || t('eventForm.pickTime')}
            </Text>
          </Pressable>
        </View>
      </Field>

      {showTimePicker && (
        <DateTimePicker
          value={(() => {
            const d = new Date();
            if (startTime) {
              const [h, m] = startTime.split(':').map(Number);
              d.setHours(h, m, 0, 0);
            } else {
              d.setHours(9, 0, 0, 0);
            }
            return d;
          })()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            setShowTimePicker(false);
            if (event.type === 'dismissed' || !selected) return;
            const hh = String(selected.getHours()).padStart(2, '0');
            const mm = String(selected.getMinutes()).padStart(2, '0');
            setStartTime(`${hh}:${mm}`);
          }}
        />
      )}

      <ChipGroup
        label={t('eventForm.category')}
        options={eventCategories.map((c) => ({ key: c.name, label: c.name }))}
        value={type}
        onPick={setType}
        footer={
          <Pressable
            onPress={() => navigation.navigate('ManageCategories', { initialTab: 'event' })}
            style={styles.manage}
            accessibilityRole="button"
          >
            <Text style={styles.manageText}>{t('expenseForm.manageCategories')}</Text>
          </Pressable>
        }
      />

      <TextField
        label={t('eventForm.notes')}
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

      {isEditing && (
        <Pressable onPress={handleDelete} style={styles.delete} accessibilityRole="button">
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
          <Text style={styles.deleteText}>{t('common.delete')}</Text>
        </Pressable>
      )}
    </FormScreen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    timeRow: { flexDirection: 'row', gap: space.sm },
    timeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm - 2,
      minHeight: HIT,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    timeOptionOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    timeText: { ...type.body, fontSize: 14, color: theme.text },
    timeTextOn: { color: '#fff', fontWeight: '600' },

    manage: { minHeight: 38, justifyContent: 'center', marginTop: space.xs },
    manageText: { ...type.secondary, color: theme.primary },

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

    // Not in the bottom bar: that bar is for the two answers to the form's own
    // question, and deleting is a different question entirely.
    delete: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm - 2,
      minHeight: HIT,
      marginTop: space.sm,
      borderRadius: radius.control,
      backgroundColor: theme.dangerLight,
    },
    deleteText: { ...type.bodyStrong, fontSize: 14, color: theme.danger },
  });
}
