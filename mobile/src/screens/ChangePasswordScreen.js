import React, { useCallback, useRef, useState } from 'react';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import FormScreen from '../components/form/FormScreen';
import TextField from '../components/form/TextField';
import useFormSubmit from '../components/form/useFormSubmit';

const MIN_LENGTH = 8;

export default function ChangePasswordScreen({ navigation }) {
  const { t } = useSettings();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});

  const currentRef = useRef(null);
  const nextRef = useRef(null);
  const confirmRef = useRef(null);

  function clearError(field) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const run = useCallback(async () => {
    try {
      await client.post('/auth/change-password', { currentPassword: current, newPassword: next });
    } catch (err) {
      // A wrong current password belongs on that field, not on a toast and not
      // in a banner at the top of a form the person has to scroll back up to.
      if (err.response?.status === 401) {
        setErrors({ current: err.response?.data?.error || t('password.failed') });
        currentRef.current?.focus();
        // Swallowed on purpose: the field is now saying it, and the submit
        // hook would otherwise say it again on a toast.
        return;
      }
      throw err;
    }
  }, [current, next, t]);

  const { submitting, submit } = useFormSubmit({
    run,
    success: t('toast.passwordChanged'),
    navigation,
    errorMessage: t('password.failed'),
  });

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

  function handleSave() {
    if (!validate()) return;
    submit();
  }

  return (
    <FormScreen
      title={t('settings.changePassword')}
      onSave={handleSave}
      submitting={submitting}
      saveLabel={t('password.save')}
      savingLabel={t('password.saving')}
    >
      <TextField
        ref={currentRef}
        label={t('password.current')}
        secure
        value={current}
        onChangeText={setCurrent}
        onClearError={() => clearError('current')}
        error={errors.current}
        returnKeyType="next"
        onSubmitEditing={() => nextRef.current?.focus()}
      />

      <TextField
        ref={nextRef}
        label={t('password.new')}
        hint={t('password.newHint')}
        secure
        value={next}
        onChangeText={setNext}
        onClearError={() => clearError('next')}
        error={errors.next}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />

      <TextField
        ref={confirmRef}
        label={t('password.confirm')}
        secure
        value={confirm}
        onChangeText={setConfirm}
        onClearError={() => clearError('confirm')}
        error={errors.confirm}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
    </FormScreen>
  );
}
