import React, { useCallback, useMemo, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import client from '../api/client';
import { EXPENSE_TYPES, CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useHouseholds } from '../context/HouseholdContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import { useDataEvents } from '../context/DataEventsContext';
import FormScreen from '../components/form/FormScreen';
import AmountField from '../components/form/AmountField';
import ChipGroup from '../components/form/ChipGroup';
import SegmentGroup from '../components/form/SegmentGroup';
import TextField from '../components/form/TextField';
import useFormSubmit from '../components/form/useFormSubmit';
import { space, type } from '../theme/scale';

export default function ExpenseFormScreen({ route, navigation }) {
  const { isSolo } = useHouseholds();
  const { date, expense } = route.params;
  const { t, currency: defaultCurrency } = useSettings();
  const { emit } = useDataEvents();
  const { expenseCategories } = useCategories();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEditing = !!expense;

  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState(expense?.category || expenseCategories[0]?.name || '');
  const [type_, setType] = useState(expense?.type || 'personal');
  const [currency, setCurrency] = useState(expense?.currency || defaultCurrency);
  const [description, setDescription] = useState(expense?.description || '');
  const [amountError, setAmountError] = useState('');

  const run = useCallback(async () => {
    const payload = { amount: parseFloat(amount), category, type: type_, currency, description, date };
    if (isEditing) {
      const updated = await client.put(`/expenses/${expense._id}`, payload);
      emit('expense', 'update', updated.data.expense);
    } else {
      const created = await client.post('/expenses', payload);
      emit('expense', 'create', created.data.expense);
    }
  }, [amount, category, type_, currency, description, date, isEditing, expense, emit]);

  const { submitting, submit } = useFormSubmit({
    run,
    success: isEditing ? t('toast.expenseSaved') : t('toast.expenseAdded'),
    navigation,
    errorMessage: t('expenseForm.saveError'),
  });

  function handleSave() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setAmountError(t('expenseForm.invalidAmountMessage'));
      return;
    }
    setAmountError('');
    submit();
  }

  return (
    <FormScreen
      title={isEditing ? t('expenseForm.saveChanges') : t('nav.addExpense')}
      onSave={handleSave}
      submitting={submitting}
      saveLabel={isEditing ? t('expenseForm.saveChanges') : t('expenseForm.addExpense')}
      savingLabel={t('expenseForm.saving')}
    >
      <AmountField
        label={t('expenseForm.amount')}
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          if (amountError) setAmountError('');
        }}
        error={amountError}
        currency={currency}
        currencies={CURRENCIES}
        onPickCurrency={setCurrency}
      />

      <ChipGroup
        label={t('expenseForm.category')}
        options={expenseCategories.map((c) => ({ key: c.name, label: c.name }))}
        value={category}
        onPick={setCategory}
        footer={
          <Pressable
            onPress={() => navigation.navigate('ManageCategories', { initialTab: 'expense' })}
            style={styles.manage}
            accessibilityRole="button"
          >
            <Text style={styles.manageText}>{t('expenseForm.manageCategories')}</Text>
          </Pressable>
        }
      />

      {/* Alone there is no "ours", so the choice is not offered and every
          expense stays personal. The field remains on the record, so nothing
          needs migrating if somebody joins later. */}
      {!isSolo && (
        <SegmentGroup
          label={t('expenseForm.type')}
          options={EXPENSE_TYPES.map((o) => ({
            key: o,
            label: o === 'personal' ? t('dayDetail.personal') : t('dayDetail.together'),
          }))}
          value={type_}
          onPick={setType}
        />
      )}

      <TextField
        label={t('expenseForm.description')}
        placeholder={t('expenseForm.descriptionPlaceholder')}
        value={description}
        onChangeText={setDescription}
        returnKeyType="done"
      />
    </FormScreen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    manage: { minHeight: 38, justifyContent: 'center', marginTop: space.xs },
    manageText: { ...type.secondary, color: theme.primary },
  });
}
