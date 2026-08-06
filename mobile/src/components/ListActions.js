import React, { useMemo, useEffect, useState  } from 'react';
import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import useKeyboardHeight from '../utils/useKeyboardHeight';
import FormError from './FormError';

// One sheet for every long-press in the Lists tab — folders, subfolders and
// items all get the same three actions in the same place. Before this, the
// long press deleted straight away: the most destructive action on the
// easiest gesture to trigger by accident, and the only one available.
//
// target: null, or
//   { kind: 'folder', id, name, parent, hasChildren, itemCount } |
//   { kind: 'item',   id, name, parent }
// onEdit is optional: items already have a full edit form (price, link, notes,
// reminder), so for those the first action opens that form instead of offering
// a second, weaker way to change just the title.
export default function ListActions({ target, folders, onClose, onRename, onMove, onDelete, onEdit }) {
  const { t } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const keyboardHeight = useKeyboardHeight();

  const [phase, setPhase] = useState('menu');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setPhase('menu');
      setName(target.name || '');
      setError('');
    }
  }, [target]);

  if (!target) return null;

  const isFolder = target.kind === 'folder';

  async function submitRename() {
    const next = name.trim();
    if (!next) {
      setError(t('validation.folderNameRequired'));
      return;
    }
    if (next === target.name) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onRename(target, next);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('manageCategories.duplicateError'));
    } finally {
      setBusy(false);
    }
  }

  async function submitMove(destinationId) {
    setBusy(true);
    try {
      await onMove(target, destinationId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('lists.moveFailed'));
      setBusy(false);
    }
  }

  // Destinations differ by what is being moved. A folder may only sit at the
  // root or inside a root folder (two levels), never inside itself or its own
  // subfolder. An item may go into any folder at any level.
  function destinations() {
    const roots = folders.filter((f) => f.parent == null);
    if (isFolder) {
      const rows = [{ id: null, label: t('lists.rootLevel'), depth: 0, icon: 'home-outline' }];
      for (const root of roots) {
        if (root._id === target.id) continue;
        rows.push({
          id: root._id,
          label: root.name,
          depth: 0,
          icon: 'folder-outline',
          // A folder that has subfolders would push them to a third level.
          disabledReason: target.hasChildren ? t('lists.hasSubfoldersReason') : null,
        });
      }
      return rows;
    }
    const rows = [];
    for (const root of roots) {
      rows.push({ id: root._id, label: root.name, depth: 0, icon: 'folder-outline' });
      for (const child of folders.filter((f) => f.parent === root._id)) {
        rows.push({ id: child._id, label: child.name, depth: 1, icon: 'folder-outline' });
      }
    }
    return rows;
  }

  const title = phase === 'move' ? t('lists.moveTo') : phase === 'rename' ? t('lists.rename') : target.name;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      {/* The sheet is bottom-anchored, so lifting it by the keyboard height is
          what keeps the rename field and its buttons visible. A Modal renders
          in its own native window and never inherits the padding Screen
          applies to the rest of the app. */}
      <View style={[styles.sheetWrap, { paddingBottom: keyboardHeight }]} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {phase === 'menu' && (
            <>
              <TouchableOpacity
                style={styles.action}
                onPress={() => {
                  if (onEdit) {
                    onEdit(target);
                    onClose();
                  } else {
                    setPhase('rename');
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={19} color={theme.text} />
                <Text style={styles.actionText}>{onEdit ? t('common.edit') : t('lists.rename')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => setPhase('move')} activeOpacity={0.7}>
                <Ionicons name="file-tray-full-outline" size={19} color={theme.text} />
                <Text style={styles.actionText}>{t('lists.moveTo')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.action, styles.actionLast]}
                onPress={() => {
                  onDelete(target);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={19} color={theme.danger} />
                <Text style={[styles.actionText, { color: theme.danger }]}>
                  {isFolder && target.itemCount > 0
                    ? t('lists.deleteWithCount', { count: target.itemCount })
                    : t('common.delete')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'rename' && (
            <View style={styles.renameWrap}>
              <TextInput
                style={[styles.input, !!error && styles.inputError]}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (error) setError('');
                }}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={submitRename}
                placeholderTextColor={theme.textSecondary}
              />
              <FormError message={error} />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={submitRename} disabled={busy} activeOpacity={0.8}>
                  <Text style={styles.primaryButtonText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {phase === 'move' && (
            <>
              <FormError message={error} />
              <ScrollView style={styles.destinationList} keyboardShouldPersistTaps="handled">
                {destinations().map((row) => {
                  const current = isFolder ? (target.parent ?? null) === row.id : target.parent === row.id;
                  const disabled = busy || current || !!row.disabledReason;
                  return (
                    <TouchableOpacity
                      key={String(row.id)}
                      style={[styles.destination, { paddingLeft: 12 + row.depth * 18 }, disabled && styles.destinationOff]}
                      onPress={() => submitMove(row.id)}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={row.disabledReason ? 'ban-outline' : row.icon}
                        size={17}
                        color={disabled ? theme.textSecondary : theme.primary}
                      />
                      <Text style={[styles.destinationText, disabled && { color: theme.textSecondary }]} numberOfLines={1}>
                        {row.label}
                      </Text>
                      {current && <Text style={styles.destinationNote}>{t('lists.currentLocation')}</Text>}
                      {!current && row.disabledReason ? (
                        <Text style={styles.destinationNote} numberOfLines={1}>
                          {row.disabledReason}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
    grabber: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    actionLast: { borderBottomWidth: 0 },
    actionText: { fontSize: 15, color: theme.text },
    renameWrap: { paddingTop: 4 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 46,
      fontSize: 15,
      color: theme.text,
      backgroundColor: theme.background,
    },
    inputError: { borderColor: theme.danger },
    buttonRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    primaryButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryButtonText: { color: theme.text, fontSize: 15 },
    destinationList: { maxHeight: 320, marginTop: 4 },
    destination: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingRight: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    destinationOff: { opacity: 0.55 },
    destinationText: { flex: 1, fontSize: 15, color: theme.text },
    destinationNote: { fontSize: 11, color: theme.textSecondary, maxWidth: 130, textAlign: 'right' },
  });
}
