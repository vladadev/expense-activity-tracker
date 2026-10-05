import React, { useMemo, useState  } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { CURRENCIES } from '../config/categories';
import Screen from '../components/Screen';
import { IS_DESIGN } from '../theme/variant';
import { isErrorReportingEnabled, sendTestEvent } from '../utils/errorReporting';
import { checkForUpdateNow } from '../utils/useAppUpdates';
import Frog from '../components/pond/Frog';
import ThemePicker from '../components/pond/ThemePicker';
import { useHouseholds } from '../context/HouseholdContext';
import { space, type } from '../theme/scale';

const LANGUAGES = [
  { code: 'sr', label: 'Srpski' },
  { code: 'en', label: 'English' },
];

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, currency, setCurrency } = useSettings();
  const { theme, themeName, setThemeName, availableThemes } = useTheme();
  const { active } = useHouseholds();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);

  // A tester has to be able to answer "am I running the thing that was just
  // published?" without being told to close the app twice and hope. The id
  // below says which bundle this is; this says whether it is the latest.
  async function handleCheckUpdate() {
    if (checking) return;
    setChecking(true);
    const result = await checkForUpdateNow();
    setChecking(false);
    if (result.state === 'ready') {
      // useAppUpdates reloads the design build on its own once the bundle is
      // down; say so rather than leaving a silent pause.
      Alert.alert(t('settings.checkUpdate'), t('settings.updateReady'));
      await Updates.reloadAsync();
      return;
    }
    Alert.alert(
      t('settings.checkUpdate'),
      result.state === 'current'
        ? t('settings.updateCurrent')
        : result.state === 'disabled'
          ? t('settings.updateDisabled')
          : t('settings.updateFailed', { reason: result.reason })
    );
  }

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

  // showBack is stated rather than left to canGoBack(): in the redesign this
  // screen is pushed from the gear in the header and needs the arrow, while in
  // the app in daily use it is still a tab — where canGoBack() answers true
  // anyway, because a tab navigator counts "back" as a return to the first tab.
  return (
    <Screen title={t('nav.settings')} showBack={IS_DESIGN}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Who you are, before what you can change. The gear in the header
            became this face, and a face that opens a list of switches is a
            face that lied. */}
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Frog size={70} still style={{ marginTop: 6 }} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
            {active ? <Text style={styles.household} numberOfLines={1}>{active.name}</Text> : null}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.theme')}</Text>
        {IS_DESIGN ? (
          <ThemePicker />
        ) : (
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
        )}

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

        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('ChangePassword')}>
          <Text style={styles.activityButtonText}>{t('settings.changePassword')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('ManageCategories')}>
          <Text style={styles.activityButtonText}>{t('settings.manageCategories')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.activityButton} onPress={() => navigation.navigate('ActivityLog')}>
          <Text style={styles.activityButtonText}>{t('settings.activityHistory')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.activityButton} onPress={handleCheckUpdate} disabled={checking}>
          <Text style={styles.activityButtonText}>
            {checking ? `${t('settings.checkUpdate')}...` : t('settings.checkUpdate')}
          </Text>
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
          {/* The app version only changes with a new APK. Over-the-air updates
              keep it identical, so the update id is what actually identifies
              which build is on a given phone when debugging with someone. */}
          <Text style={styles.versionText}>
            v{Constants.expoConfig?.version || '?'}
            {'  ·  '}
            {Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded'}
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
    profile: { flexDirection: 'row', alignItems: 'center', gap: space.md - 2, marginBottom: space.lg },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.border,
    },
    name: { ...type.title, color: theme.text },
    email: { ...type.secondary, color: theme.textSecondary, marginTop: 2 },
    household: { ...type.secondary, color: theme.primary, marginTop: 4 },
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
