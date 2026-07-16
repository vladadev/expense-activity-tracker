import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '../api/client';
import { CURRENCIES } from '../config/categories';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { formatLongDate } from '../i18n/dateFormat';

export default function SavingsFormScreen({ route, navigation }) {
  const { entry } = route.params || {};
  const isEditing = !!entry;
  const { t, language, currency: defaultCurrency } = useSettings();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [type, setType] = useState(entry?.type || 'personal');
  const [owner, setOwner] = useState(entry?.owner?._id || user?.id);
  const [users, setUsers] = useState([]);
  const [direction, setDirection] = useState(entry?.direction || 'deposit');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [currency, setCurrency] = useState(entry?.currency || defaultCurrency);
  const [description, setDescription] = useState(entry?.description || '');
  const [date, setDate] = useState(entry?.date ? new Date(entry.date) : new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    client.get('/auth/users').then((res) => setUsers(res.data.users));
  }, []);

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('expenseForm.invalidAmountTitle'), t('expenseForm.invalidAmountMessage'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type,
        owner: type === 'personal' ? owner : undefined,
        direction,
        amount: parsedAmount,
        currency,
        description,
        date: date.toISOString(),
      };
      if (isEditing) {
        await client.put(`/savings/${entry._id}`, payload);
      } else {
        await client.post('/savings', payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('savings.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title={isEditing ? t('expenseForm.saveChanges') : t('nav.addSavingsEntry')}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('savings.entryType')}</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, type === 'personal' && styles.chipActive]}
          onPress={() => setType('personal')}
        >
          <Text style={[styles.chipText, type === 'personal' && styles.chipTextActive]}>{t('savings.personal')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, type === 'together' && styles.chipActive]}
          onPress={() => setType('together')}
        >
          <Text style={[styles.chipText, type === 'together' && styles.chipTextActive]}>{t('savings.together')}</Text>
        </TouchableOpacity>
      </View>

      {type === 'personal' && (
        <>
          <Text style={styles.label}>{t('dayDetail.personal')}</Text>
          <View style={styles.chipRow}>
            {users.map((u) => (
              <TouchableOpacity
                key={u._id}
                style={[styles.chip, owner === u._id && styles.chipActive]}
                onPress={() => setOwner(u._id)}
              >
                <Text style={[styles.chipText, owner === u._id && styles.chipTextActive]}>{u.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>{t('savings.deposit')} / {t('savings.withdrawal')}</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, direction === 'deposit' && styles.chipActive]}
          onPress={() => setDirection('deposit')}
        >
          <Text style={[styles.chipText, direction === 'deposit' && styles.chipTextActive]}>{t('savings.deposit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, direction === 'withdrawal' && styles.chipActive]}
          onPress={() => setDirection('withdrawal')}
        >
          <Text style={[styles.chipText, direction === 'withdrawal' && styles.chipTextActive]}>{t('savings.withdrawal')}</Text>
        </TouchableOpacity>
      </View>

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

      <Text style={styles.label}>{t('savings.amount')}</Text>
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
          <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]} onPress={() => setCurrency(c)}>
            <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('savings.description')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('savings.descriptionPlaceholder')}
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
