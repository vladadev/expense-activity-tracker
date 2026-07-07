import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('login.missingInfoTitle'), t('login.missingInfoMessage'));
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const message = err.response?.data?.error || t('login.failedMessage');
      Alert.alert(t('login.failedTitle'), message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>{t('app.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('login.email')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t('login.password')}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? t('login.loading') : t('login.button')}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.background },
    title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: theme.text },
    subtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 32 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      marginBottom: 14,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
