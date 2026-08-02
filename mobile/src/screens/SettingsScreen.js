import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { CURRENCIES } from '../config/categories';
import Screen from '../components/Screen';
import { isErrorReportingEnabled, sendTestEvent } from '../utils/errorReporting';

const LANGUAGES = [
  { code: 'sr', label: 'Srpski' },
  { code: 'en', label: 'English' },
];

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, currency, setCurrency } = useSettings();
  const { theme, themeName, setThemeName, availableThemes } = useTheme();
  const styles = createStyles(theme);

  const [testing, setTesting] = useState(false);

  function handleLogout() {
    Alert.alert(t('settings.logoutConfirmTitle'), t('settings.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: logout },
    ]);
  }

  // Long-press, not a visible button: this is a diagnostic, not a feature.
  async function handleDiagnostics() {
    if (testing) return;
    setTesting(true);
    const result = await sendTestEvent();
    setTesting(false);
    Alert.alert(
      t('settings.diagnostics'),
      result.ok
        ? t('settings.diagnosticsOk')
        : result.reason === 'disabled'
          ? t('settings.diagnosticsDisabled')
          : t('settings.diagnosticsFailed', { reason: result.reason })
    );
  }

  return (
    <Screen title={t('nav.settings')} showBack={false}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Text style={styles.sectionLabel}>{t('settings.theme')}</Text>
        <View style={styles.chipRow}>
          {Object.entries(availableThemes).map(([key, palette]) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, themeName === key && styles.chipActive]}
              onPress={() => setThemeName(key)}
            >
              <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
              <Text style={[styles.chipText, themeName === key && styles.chipTextActive]}>{palette.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
        <View style={styles.chipRow}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.chip, language === l.code && styles.chipActive]}
              onPress={() => setLanguage(l.code)}
            >
              <Text style={[styles.chipText, language === l.code && styles.chipTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('settings.currency')}</Text>
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

        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('Household')}>
          <Text style={styles.activityButtonText}>{t('settings.household')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('ManageCategories')}>
          <Text style={styles.activityButtonText}>{t('settings.manageCategories')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('ActivityLog')}>
          <Text style={styles.activityButtonText}>{t('settings.activityHistory')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onLongPress={handleDiagnostics}
          delayLongPress={800}
          activeOpacity={1}
          style={styles.versionRow}
        >
          <Text style={styles.versionText}>
            v{Constants.expoConfig?.version || '?'}
            {'  ·  '}
            {isErrorReportingEnabled() ? t('settings.reportingOn') : t('settings.reportingOff')}
            {testing ? '  ·  ...' : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    name: { fontSize: 22, fontWeight: '700', color: theme.text },
    email: { fontSize: 14, color: theme.textSecondary, marginTop: 4, marginBottom: 24 },
    versionRow: { alignItems: 'center', paddingVertical: 20 },
    versionText: { fontSize: 11, color: theme.textSecondary },
    sectionLabel: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
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
    swatch: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    activityButton: {
      backgroundColor: theme.primaryLight,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    activityButtonText: { color: theme.primary, fontSize: 16, fontWeight: '600' },
    logoutButton: {
      backgroundColor: theme.dangerLight,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
    },
    logoutButtonText: { color: theme.danger, fontSize: 16, fontWeight: '600' },
  });
}
