import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '../api/client';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { formatLongDate } from '../i18n/dateFormat';

export default function IncomeFormScreen({ route, navigation }) {
  const { entry } = route.params || {};
  const isEditing = !!entry;
  const { t, language, currency: defaultCurrency } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [currency, setCurrency] = useState(entry?.currency || defaultCurrency);
  const [description, setDescription] = useState(entry?.description || '');
  const [date, setDate] = useState(entry?.date ? new Date(entry.date) : new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('expenseForm.invalidAmountTitle'), t('expenseForm.invalidAmountMessage'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = { amount: parsedAmount, currency, description, date: date.toISOString() };
      if (isEditing) {
        await client.put(`/income/${entry._id}`, payload);
      } else {
        await client.post('/income', payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('finance.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title={isEditing ? t('expenseForm.saveChanges') : t('nav.addIncomeEntry')}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('finance.amount')}</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>{t('finance.date')}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={{ color: theme.text }}>{formatLongDate(date.toISOString().slice(0, 10), language)}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selected) => {
              setShowPicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}

        <Text style={styles.label}>{t('expenseForm.currency')}</Text>
        <View style={styles.chipRow}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]} onPress={() => setCurrency(c)}>
              <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('finance.description')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('finance.descriptionPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
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
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
