import React, { useMemo, useRef, useState  } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { useToast } from '../components/Toast';
import FormError from '../components/FormError';

const MIN_LENGTH = 8;

export default function ChangePasswordScreen({ navigation }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const toast = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const currentRef = useRef(null);
  const nextRef = useRef(null);
  const confirmRef = useRef(null);

  function clearError(field) {
    if (errors[field] || errors.form) {
      setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
    }
  }

  function validate() {
    const found = {};
    if (!current) found.current = t('password.currentRequired');
    if (next.length < MIN_LENGTH) found.next = t('password.tooShort');
    else if (next === current) found.next = t('password.mustDiffer');
    if (confirm !== next) found.confirm = t('password.mismatch');
    setErrors(found);

    if (found.current) currentRef.current?.focus();
    else if (found.next) nextRef.current?.focus();
    else if (found.confirm) confirmRef.current?.focus();

    return Object.keys(found).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await client.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast.success(t('toast.passwordChanged'));
      Alert.alert(t('password.doneTitle'), t('password.doneBody'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const message = err.response?.data?.error || t('password.failed');
      // A wrong current password belongs on that field, not in a generic banner.
      if (err.response?.status === 401) {
        setErrors({ current: message });
        currentRef.current?.focus();
      } else {
        setErrors({ form: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(label, value, setValue, field, ref, nextRefToFocus, placeholder) {
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputWrap, !!errors[field] && styles.inputError]}>
          <TextInput
            ref={ref}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            value={value}
            onChangeText={(v) => {
              setValue(v);
              clearError(field);
            }}
            returnKeyType={nextRefToFocus ? 'next' : 'done'}
            onSubmitEditing={() => (nextRefToFocus ? nextRefToFocus.current?.focus() : handleSubmit())}
          />
        </View>
        <FormError message={errors[field]} />
      </>
    );
  }

  return (
    <Screen title={t('password.title')}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('password.intro')}</Text>

        {renderField(t('password.current'), current, setCurrent, 'current', currentRef, nextRef, '••••••••')}
        {renderField(t('password.new'), next, setNext, 'next', nextRef, confirmRef, t('password.newHint'))}
        {renderField(t('password.confirm'), confirm, setConfirm, 'confirm', confirmRef, null, '••••••••')}

        <TouchableOpacity style={styles.showRow} onPress={() => setShow((s) => !s)} activeOpacity={0.7}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textSecondary} />
          <Text style={styles.showText}>{show ? t('password.hide') : t('password.show')}</Text>
        </TouchableOpacity>

        <FormError message={errors.form} style={{ marginTop: 12 }} />

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{submitting ? t('password.saving') : t('password.save')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    intro: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 14 },
    inputWrap: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    inputError: { borderColor: theme.danger, borderWidth: 1.5 },
    input: { padding: 14, fontSize: 15, color: theme.text },
    showRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 14 },
    showText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 12,
    },
    buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
