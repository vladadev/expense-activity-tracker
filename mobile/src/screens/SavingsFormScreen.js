import React, { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { cachedGet } from '../api/cachedGet';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useHouseholds } from '../context/HouseholdContext';
import { useAuth } from '../context/AuthContext';
import { useDataEvents } from '../context/DataEventsContext';
import FormScreen from '../components/form/FormScreen';
import AmountField from '../components/form/AmountField';
import ChipGroup from '../components/form/ChipGroup';
import SegmentGroup from '../components/form/SegmentGroup';
import DateField from '../components/form/DateField';
import TextField from '../components/form/TextField';
import useFormSubmit from '../components/form/useFormSubmit';

export default function SavingsFormScreen({ route, navigation }) {
  const { isSolo } = useHouseholds();
  const { entry } = route.params || {};
  const isEditing = !!entry;
  const { t, currency: defaultCurrency } = useSettings();
  const { emit } = useDataEvents();
  const { user } = useAuth();

  const [type, setType] = useState(entry?.type || 'personal');
  const [owner, setOwner] = useState(entry?.owner?._id || user?.id);
  const [users, setUsers] = useState([]);
  const [direction, setDirection] = useState(entry?.direction || 'deposit');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [currency, setCurrency] = useState(entry?.currency || defaultCurrency);
  const [description, setDescription] = useState(entry?.description || '');
  const [date, setDate] = useState(entry?.date ? new Date(entry.date) : new Date());
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    cachedGet('/auth/users').then((res) => setUsers(res.data.users));
  }, []);

  const run = useCallback(async () => {
    const payload = {
      type,
      owner: type === 'personal' ? owner : undefined,
      direction,
      amount: parseFloat(amount),
      currency,
      description,
      date: date.toISOString(),
    };
    if (isEditing) {
      const updated = await client.put(`/savings/${entry._id}`, payload);
      emit('savings', 'update', updated.data.entry);
    } else {
      const created = await client.post('/savings', payload);
      emit('savings', 'create', created.data.entry);
    }
  }, [type, owner, direction, amount, currency, description, date, isEditing, entry, emit]);

  const { submitting, submit } = useFormSubmit({
    run,
    success: isEditing ? t('toast.savingsSaved') : t('toast.savingsAdded'),
    navigation,
    errorMessage: t('savings.saveError'),
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
      title={isEditing ? t('expenseForm.saveChanges') : t('nav.addSavingsEntry')}
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

      <SegmentGroup
        label={t('savings.direction')}
        options={[
          { key: 'deposit', label: t('savings.deposit') },
          { key: 'withdrawal', label: t('savings.withdrawal') },
        ]}
        value={direction}
        onPick={setDirection}
      />

      {/* Alone, saving is neither personal nor shared — it is just saving. */}
      {!isSolo && (
        <SegmentGroup
          label={t('savings.entryType')}
          options={[
            { key: 'personal', label: t('savings.personal') },
            { key: 'together', label: t('savings.together') },
          ]}
          value={type}
          onPick={setType}
        />
      )}

      {type === 'personal' && users.length > 1 && (
        <ChipGroup
          label={t('dayDetail.personal')}
          options={users.map((u) => ({ key: u._id, label: u.name }))}
          value={owner}
          onPick={setOwner}
        />
      )}

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
