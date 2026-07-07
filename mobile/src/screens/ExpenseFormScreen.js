import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import client from '../api/client';
import { EXPENSE_TYPES, CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';

export default function ExpenseFormScreen({ route, navigation }) {
  const { date, expense } = route.params;
  const { t, currency: defaultCurrency } = useSettings();
  const { expenseCategories } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const isEditing = !!expense;

  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState(expense?.category || expenseCategories[0]?.name || '');
  const [type, setType] = useState(expense?.type || 'personal');
  const [currency, setCurrency] = useState(expense?.currency || defaultCurrency);
  const [description, setDescription] = useState(expense?.description || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('expenseForm.invalidAmountTitle'), t('expenseForm.invalidAmountMessage'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = { amount: parsedAmount, category, type, currency, description, date };
      if (isEditing) {
        await client.put(`/expenses/${expense._id}`, payload);
      } else {
        await client.post('/expenses', payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('expenseForm.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title={isEditing ? t('expenseForm.saveChanges') : t('nav.addExpense')}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('expenseForm.amount')}</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>{t('expenseForm.currency')}</Text>
      <View style={styles.chipRow}>
        {CURRENCIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, currency === c && styles.chipActive]}
            onPress={() => setCurrency(c)}
          >
            <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('expenseForm.category')}</Text>
      <View style={styles.chipRow}>
        {expenseCategories.map((c) => (
          <TouchableOpacity
            key={c._id}
            style={[styles.chip, category === c.name && styles.chipActive]}
            onPress={() => setCategory(c.name)}
          >
            <Text style={[styles.chipText, category === c.name && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('ManageCategories', { initialTab: 'expense' })}>
        <Text style={styles.manageLink}>{t('expenseForm.manageCategories')}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{t('expenseForm.type')}</Text>
      <View style={styles.chipRow}>
        {EXPENSE_TYPES.map((typeOption) => (
          <TouchableOpacity
            key={typeOption}
            style={[styles.chip, type === typeOption && styles.chipActive]}
            onPress={() => setType(typeOption)}
          >
            <Text style={[styles.chipText, type === typeOption && styles.chipTextActive]}>
              {typeOption === 'personal' ? t('dayDetail.personal') : t('dayDetail.together')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('expenseForm.description')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('expenseForm.descriptionPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={submitting}>
        <Text style={styles.saveButtonText}>
          {submitting ? t('expenseForm.saving') : isEditing ? t('expenseForm.saveChanges') : t('expenseForm.addExpense')}
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
    manageLink: { color: theme.primary, fontSize: 13, marginTop: 4 },
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
