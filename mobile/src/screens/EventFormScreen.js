import React, { useMemo, useEffect, useRef, useState  } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { cachedGet } from '../api/cachedGet';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import { formatShortDateTime } from '../i18n/dateFormat';
import Screen from '../components/Screen';
import { SkeletonBlock } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useDataEvents } from '../context/DataEventsContext';
import FormError from '../components/FormError';

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
  const [formError, setFormError] = useState('');
  const titleRef = useRef(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState(new Date(date + 'T09:00:00'));
  // Android's native picker only supports a single date OR time widget at a
  // time — there's no combined "datetime" mode like on iOS. Passing
  // mode="datetime" on Android crashes, so we show date then time in sequence.
  const [pickerStep, setPickerStep] = useState(null); // null | 'date' | 'time'
  const [submitting, setSubmitting] = useState(false);
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
        toast.success(t('toast.eventSaved'));
      } else {
        const created = await client.post('/events', payload);
        emit('event', 'create', created.data.event);
        toast.success(t('toast.eventAdded'));
      }
      navigation.goBack();
    } catch (err) {
      setFormError(err.response?.data?.error || t('eventForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
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
        <View style={styles.container}>
          <SkeletonBlock width={'70%'} height={22} radius={8} y={40} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={screenTitle}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('eventForm.titleLabel')}</Text>
      <TextInput
        ref={titleRef}
        style={[styles.input, !!titleError && styles.inputError]}
        placeholder={t('eventForm.titlePlaceholder')}
        placeholderTextColor={theme.textSecondary}
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (titleError) setTitleError('');
        }}
      />
      <FormError message={titleError} />

      <Text style={styles.label}>{t('eventForm.time')}</Text>
      <View style={styles.timeRow}>
        <TouchableOpacity
          style={[styles.timeOption, !startTime && styles.timeOptionActive]}
          onPress={() => setStartTime(null)}
          activeOpacity={0.7}
        >
          <Ionicons name="sunny-outline" size={15} color={!startTime ? '#fff' : theme.textSecondary} />
          <Text style={[styles.timeOptionText, !startTime && styles.timeOptionTextActive]}>
            {t('eventForm.allDay')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.timeOption, !!startTime && styles.timeOptionActive]}
          onPress={() => setShowTimePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={15} color={startTime ? '#fff' : theme.textSecondary} />
          <Text style={[styles.timeOptionText, !!startTime && styles.timeOptionTextActive]}>
            {startTime || t('eventForm.pickTime')}
          </Text>
        </TouchableOpacity>
      </View>

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

      <Text style={styles.label}>{t('eventForm.category')}</Text>
      <View style={styles.chipRow}>
        {eventCategories.map((c) => (
          <TouchableOpacity
            key={c._id}
            style={[styles.chip, type === c.name && styles.chipActive]}
            onPress={() => setType(c.name)}
          >
            <Text style={[styles.chipText, type === c.name && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('ManageCategories', { initialTab: 'event' })}>
        <Text style={styles.manageLink}>{t('expenseForm.manageCategories')}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{t('eventForm.notes')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('eventForm.notesPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.reminderRow}>
        <Text style={styles.label}>{t('eventForm.reminder')}</Text>
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
          {submitting ? t('eventForm.saving') : isEditing ? t('eventForm.saveChanges') : t('eventForm.add')}
        </Text>
      </TouchableOpacity>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
        </TouchableOpacity>
      )}
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
    timeRow: { flexDirection: 'row', gap: 8 },
    timeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    timeOptionActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    timeOptionText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    timeOptionTextActive: { color: '#fff' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
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
    manageLink: { color: theme.primary, fontSize: 13, marginTop: 4 },
    reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginTop: 28,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    deleteButton: { padding: 16, alignItems: 'center', marginBottom: 40 },
    deleteButtonText: { color: theme.danger, fontSize: 15, fontWeight: '600' },
  });
}
