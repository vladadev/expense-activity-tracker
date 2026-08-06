import React, { useMemo, useRef, useState  } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import FormError from '../components/FormError';

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// One screen with a Login/Sign-up switch rather than two separate screens:
// someone who taps the wrong one can switch without losing what they typed.
export default function LoginScreen() {
  const { login, register } = useAuth();
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const isRegister = mode === 'register';

  function switchMode(next) {
    if (next === mode) return;
    setMode(next);
    setErrors({});
  }

  function clearError(field) {
    if (errors[field] || errors.form) {
      setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
    }
  }

  function validate() {
    const next = {};
    if (isRegister && !name.trim()) next.name = t('auth.nameRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('auth.emailRequired');
    if (isRegister && password.length < 8) next.password = t('auth.passwordTooShort');
    if (!isRegister && !password) next.password = t('login.missingInfoMessage');
    setErrors(next);

    // Focus the first field that failed, so the fix is one tap away.
    if (next.name) nameRef.current?.focus();
    else if (next.email) emailRef.current?.focus();
    else if (next.password) passwordRef.current?.focus();

    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setErrors({
        form: err.response?.data?.error || t(isRegister ? 'auth.registerFailed' : 'login.failedMessage'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="wallet-outline" size={28} color={theme.primary} />
            </View>
            <Text style={styles.appName}>{t('app.title')}</Text>
          </View>

          <View style={styles.segmentRow}>
            {[
              { key: 'login', label: t('auth.tabLogin') },
              { key: 'register', label: t('auth.tabRegister') },
            ].map((seg) => (
              <TouchableOpacity
                key={seg.key}
                style={[styles.segment, mode === seg.key && styles.segmentActive]}
                onPress={() => switchMode(seg.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, mode === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isRegister && (
            <>
              <Text style={styles.label}>{t('auth.name')}</Text>
              <TextInput
                ref={nameRef}
                style={[styles.input, !!errors.name && styles.inputError]}
                placeholder={t('auth.namePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  clearError('name');
                }}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              <FormError message={errors.name} />
            </>
          )}

          <Text style={styles.label}>{t('login.email')}</Text>
          <TextInput
            ref={emailRef}
            style={[styles.input, !!errors.email && styles.inputError]}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clearError('email');
            }}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <FormError message={errors.email} />

          <Text style={styles.label}>{t('login.password')}</Text>
          <View style={[styles.passwordWrap, !!errors.password && styles.inputError]}>
            <TextInput
              ref={passwordRef}
              style={styles.passwordInput}
              placeholder={isRegister ? t('auth.passwordHint') : '••••••••'}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clearError('password');
              }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingHorizontal: 12 }}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <FormError message={errors.password} />

          <FormError message={errors.form} style={{ marginTop: 16 }} />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
            <Text style={styles.buttonText}>
              {submitting
                ? t(isRegister ? 'auth.creating' : 'login.loading')
                : t(isRegister ? 'auth.createAccount' : 'login.button')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    brand: { alignItems: 'center', marginBottom: 28 },
    logo: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    appName: { fontSize: 17, fontWeight: '700', color: theme.text, textAlign: 'center' },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: hexToRgba(theme.textSecondary, 0.1),
      borderRadius: 12,
      padding: 4,
      marginBottom: 20,
    },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    segmentActive: { backgroundColor: theme.primary },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    segmentTextActive: { color: '#fff' },
    label: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    inputError: { borderColor: theme.danger, borderWidth: 1.5 },
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    passwordInput: { flex: 1, padding: 14, fontSize: 15, color: theme.text },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
