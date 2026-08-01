import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Share, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Screen from '../components/Screen';
import FormError from '../components/FormError';
import { getPersonColor } from '../utils/personColor';

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function HouseholdScreen() {
  const { t } = useSettings();
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();
  const styles = createStyles(theme);

  const [household, setHousehold] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const [showLeave, setShowLeave] = useState(false);
  const [leaveText, setLeaveText] = useState('');
  const [leaveError, setLeaveError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await client.get('/households/mine');
      setHousehold(res.data.household);
    } catch (err) {
      console.log('Failed to load household:', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function generateCode() {
    setBusy(true);
    try {
      await client.post('/households/invite');
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('wishlist.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  // Share sheet rather than a clipboard API: Share ships with React Native, so
  // this keeps working over OTA updates, and the sheet already offers "Copy"
  // alongside Viber/WhatsApp/etc.
  async function shareCode() {
    try {
      await Share.share({ message: `${t('household.shareThisCode')}: ${household.inviteCode}` });
    } catch (e) {
      // User dismissed the share sheet — nothing to handle.
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) {
      setJoinError(t('household.codeRequired'));
      return;
    }
    setBusy(true);
    setJoinError('');
    try {
      const res = await client.post('/households/join', { code: joinCode.trim() });
      await refreshUser();
      setShowJoin(false);
      setJoinCode('');
      await load();
      Alert.alert(t('household.joined', { name: res.data.household.name }));
    } catch (err) {
      setJoinError(err.response?.data?.error || t('wishlist.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (leaveText.trim() !== household.name) {
      setLeaveError(t('household.leaveConfirmMismatch'));
      return;
    }
    setBusy(true);
    setLeaveError('');
    try {
      await client.post('/households/leave', { confirmName: leaveText.trim() });
      await refreshUser();
      setShowLeave(false);
      setLeaveText('');
      await load();
    } catch (err) {
      setLeaveError(err.response?.data?.error || t('household.leaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!household) {
    return (
      <Screen title={t('household.title')}>
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const hoursLeft = household.inviteCodeExpiresAt
    ? Math.max(0, Math.round((new Date(household.inviteCodeExpiresAt) - Date.now()) / 3600000))
    : 0;
  const isAlone = household.members.length < 2;

  return (
    <Screen title={t('household.title')}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.householdName}>{household.name}</Text>

        <Text style={styles.sectionTitle}>
          {t('household.members')} · {household.members.length}/2
        </Text>
        {household.members.map((m) => {
          const color = getPersonColor(m.name);
          return (
            <View key={m._id} style={styles.memberRow}>
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberMeta}>{String(m._id) === String(user.id) ? t('household.you') : m.email}</Text>
              </View>
            </View>
          );
        })}

        {isAlone && (
          <View style={styles.emptySlot}>
            <View style={styles.emptyAvatar}>
              <Ionicons name="person-add-outline" size={18} color={theme.textSecondary} />
            </View>
            <Text style={styles.emptySlotText}>{t('household.emptySlot')}</Text>
          </View>
        )}

        {isAlone && (
          <>
            <Text style={styles.sectionTitle}>{t('household.invitePartner')}</Text>
            {household.inviteCode ? (
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>{t('household.shareThisCode')}</Text>
                <Text style={styles.code}>{household.inviteCode}</Text>
                <Text style={styles.codeExpiry}>{t('household.expiresIn', { hours: hoursLeft })}</Text>
                <TouchableOpacity style={styles.codeButton} onPress={shareCode} activeOpacity={0.8}>
                  <Ionicons name="share-outline" size={16} color={theme.text} />
                  <Text style={styles.codeButtonText}>{t('household.share')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.primaryButton} onPress={generateCode} disabled={busy} activeOpacity={0.85}>
                <Ionicons name="key-outline" size={17} color="#fff" />
                <Text style={styles.primaryButtonText}>{t('household.generateCode')}</Text>
              </TouchableOpacity>
            )}

            {showJoin ? (
              <View style={styles.joinCard}>
                <Text style={styles.joinTitle}>{t('household.joinTitle')}</Text>
                <Text style={styles.joinBody}>{t('household.joinBody')}</Text>
                <TextInput
                  style={[styles.codeInput, !!joinError && styles.inputError]}
                  placeholder={t('household.codePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  value={joinCode}
                  onChangeText={(v) => {
                    setJoinCode(v.toUpperCase());
                    if (joinError) setJoinError('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  autoFocus
                />
                <FormError message={joinError} />
                <View style={styles.joinActions}>
                  <TouchableOpacity
                    style={styles.ghostButton}
                    onPress={() => {
                      setShowJoin(false);
                      setJoinCode('');
                      setJoinError('');
                    }}
                  >
                    <Text style={styles.ghostButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={busy} activeOpacity={0.85}>
                    <Text style={styles.primaryButtonText}>{busy ? t('household.joining') : t('household.join')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.haveCodeRow} onPress={() => setShowJoin(true)}>
                <Text style={styles.haveCodeText}>
                  {t('household.haveCode')} <Text style={styles.haveCodeLink}>{t('household.enterIt')}</Text>
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {!isAlone && (
          <View style={styles.dangerZone}>
            {showLeave ? (
              <View style={styles.leaveCard}>
                <View style={styles.leaveHeader}>
                  <Ionicons name="warning-outline" size={20} color={theme.danger} />
                  <Text style={styles.leaveTitle}>{t('household.leaveTitle')}</Text>
                </View>
                <Text style={styles.leaveBody}>{t('household.leaveBody')}</Text>
                <Text style={styles.leavePrompt}>{t('household.leaveConfirmPrompt', { name: household.name })}</Text>
                <TextInput
                  style={[styles.codeInput, { letterSpacing: 0, fontSize: 15 }, !!leaveError && styles.inputError]}
                  placeholder={household.name}
                  placeholderTextColor={theme.textSecondary}
                  value={leaveText}
                  onChangeText={(v) => {
                    setLeaveText(v);
                    if (leaveError) setLeaveError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <FormError message={leaveError} />
                <View style={styles.joinActions}>
                  <TouchableOpacity
                    style={styles.ghostButton}
                    onPress={() => {
                      setShowLeave(false);
                      setLeaveText('');
                      setLeaveError('');
                    }}
                  >
                    <Text style={styles.ghostButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.joinButton,
                      { backgroundColor: leaveText.trim() === household.name ? theme.danger : hexToRgba(theme.danger, 0.4) },
                    ]}
                    onPress={handleLeave}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>
                      {busy ? t('household.leaving') : t('household.leaveButton')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.leaveLink} onPress={() => setShowLeave(true)}>
                <Ionicons name="exit-outline" size={16} color={theme.danger} />
                <Text style={styles.leaveLinkText}>{t('household.leave')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    loading: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
    householdName: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 20 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 8,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    memberName: { fontSize: 15, fontWeight: '600', color: theme.text },
    memberMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
    emptySlot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    emptyAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptySlotText: { flex: 1, fontSize: 14, color: theme.textSecondary },
    codeCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
    },
    codeLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 8 },
    code: {
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: 6,
      color: theme.primary,
      fontVariant: ['tabular-nums'],
    },
    codeExpiry: { fontSize: 11, color: theme.textSecondary, marginTop: 8 },
    codeButton: {
      alignSelf: 'stretch',
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 11,
    },
    codeButtonText: { fontSize: 13, fontWeight: '600', color: theme.text },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
    },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    haveCodeRow: { alignItems: 'center', paddingVertical: 18 },
    haveCodeText: { fontSize: 13, color: theme.textSecondary },
    haveCodeLink: { color: theme.primary, fontWeight: '700' },
    joinCard: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginTop: 16 },
    joinTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 6 },
    joinBody: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 14 },
    codeInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 6,
      textAlign: 'center',
      color: theme.text,
      backgroundColor: theme.background,
    },
    inputError: { borderColor: theme.danger, borderWidth: 1.5 },
    joinActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    ghostButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
    ghostButtonText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    joinButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
    },
    dangerZone: { marginTop: 32, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 16 },
    leaveLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    leaveLinkText: { fontSize: 14, fontWeight: '600', color: theme.danger },
    leaveCard: {
      backgroundColor: hexToRgba(theme.danger, 0.08),
      borderWidth: 1,
      borderColor: hexToRgba(theme.danger, 0.3),
      borderRadius: 14,
      padding: 16,
    },
    leaveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    leaveTitle: { fontSize: 15, fontWeight: '700', color: theme.danger },
    leaveBody: { fontSize: 13, color: theme.text, lineHeight: 19, marginBottom: 14 },
    leavePrompt: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
  });
}
