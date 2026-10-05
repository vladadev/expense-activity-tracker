import React, { useCallback, useState } from 'react';
import client from '../api/client';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useDataEvents } from '../context/DataEventsContext';
import FormScreen from '../components/form/FormScreen';
import AmountField from '../components/form/AmountField';
import DateField from '../components/form/DateField';
import TextField from '../components/form/TextField';
import useFormSubmit from '../components/form/useFormSubmit';

export default function IncomeFormScreen({ route, navigation }) {
  const { entry } = route.params || {};
  const isEditing = !!entry;
  const { t, currency: defaultCurrency } = useSettings();
  const { emit } = useDataEvents();

  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [currency, setCurrency] = useState(entry?.currency || defaultCurrency);
  const [description, setDescription] = useState(entry?.description || '');
  const [date, setDate] = useState(entry?.date ? new Date(entry.date) : new Date());
  const [amountError, setAmountError] = useState('');

  const run = useCallback(async () => {
    const payload = { amount: parseFloat(amount), currency, description, date: date.toISOString() };
    if (isEditing) {
      const updated = await client.put(`/income/${entry._id}`, payload);
      emit('income', 'update', updated.data.entry);
    } else {
      const created = await client.post('/income', payload);
      emit('income', 'create', created.data.entry);
    }
  }, [amount, currency, description, date, isEditing, entry, emit]);

  const { submitting, submit } = useFormSubmit({
    run,
    success: isEditing ? t('toast.incomeSaved') : t('toast.incomeAdded'),
    navigation,
    errorMessage: t('finance.saveError'),
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
      title={isEditing ? t('expenseForm.saveChanges') : t('nav.addIncomeEntry')}
      onSave={handleSave}
      submitting={submitting}
      saveLabel={isEditing ? t('expenseForm.saveChanges') : t('common.add')}
      savingLabel={t('expenseForm.saving')}
    >
      <AmountField
        label={t('finance.amount')}
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

      <DateField label={t('finance.date')} value={date} onChange={setDate} />

      <TextField
        label={t('finance.description')}
        placeholder={t('finance.descriptionPlaceholder')}
        value={description}
        onChangeText={setDescription}
        returnKeyType="done"
      />
    </FormScreen>
  );
}
