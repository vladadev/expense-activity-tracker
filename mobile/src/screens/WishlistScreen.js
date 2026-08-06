import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import FormError from '../components/FormError';
import ListActions from '../components/ListActions';

const FOLDER_HEIGHT = 84;
const FOLDER_GAP = 10;
const STEP = FOLDER_HEIGHT + FOLDER_GAP;
// How long the finger must rest over another folder before the drag switches
// from reordering to dropping into it, and how far it may drift while resting.
const DWELL_MS = 500;
const DWELL_TOLERANCE = 8;

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function WishlistScreen({ navigation }) {
  const { t } = useSettings();
  const {
    wishlistCategories,
    todoCategories,
    addCategory,
    renameCategory,
    moveCategory,
    deleteCategory,
    reorderCategories,
  } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  // 'wishlist' | 'todo' — which list type the tab shows.
  const [listType, setListType] = useState('wishlist');
  // To-Do only: 'folders' shows the folder cards, 'all' flattens every
  // outstanding task into one list grouped by the folder it came from, so
  // nothing has to be hunted for folder by folder.
  const [todoView, setTodoView] = useState('folders');
  const [actionTarget, setActionTarget] = useState(null);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const nameInputRef = useRef(null);

  // ---- drag machinery (refs + Animated only; no re-render mid-gesture) ----
  const [activeId, setActiveId] = useState(null);
  // Which folder the dragged card would drop into. Kept in a ref for the
  // gesture (which must not depend on render timing) and in state for the
  // highlight. Responders live in refs and are created once, so the extra
  // render this causes cannot reset the gesture.
  const [nestTargetId, setNestTargetId] = useState(null);
  const nestTargetRef = useRef(null);
  const dwellRef = useRef({ timer: null, index: -1, dy: 0 });
  const dragY = useRef(new Animated.Value(0)).current;
  const respondersRef = useRef({});
  const shiftsRef = useRef({});
  const folderIdsRef = useRef([]);
  const dragMetaRef = useRef(null);
  const finishDragRef = useRef(() => {});
  const listTypeRef = useRef(listType);
  listTypeRef.current = listType;
  const categoriesRef = useRef([]);

  const categories = listType === 'wishlist' ? wishlistCategories : todoCategories;
  const rootFolders = categories.filter((c) => !c.parent).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  folderIdsRef.current = rootFolders.map((c) => c._id);
  categoriesRef.current = categories;

  // All items in one fetch, so each folder card can show its (and its
  // subfolders') item count and progress.
  const loadCounts = useCallback(async () => {
    try {
      const res = await client.get('/wishlist/items');
      setAllItems(res.data.items);
    } catch (err) {
      console.log('Failed to load wishlist items:', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  function shiftFor(id) {
    if (!shiftsRef.current[id]) shiftsRef.current[id] = new Animated.Value(0);
    return shiftsRef.current[id];
  }

  // Applies the gap that shows where the dragged card would land. Passing
  // hover === null closes every gap, which is what nesting mode wants: the
  // list settles back and the highlighted folder becomes the only signal.
  function applyShifts(meta, hover) {
    folderIdsRef.current.forEach((otherId, position) => {
      if (otherId === meta.id) return;
      let target = 0;
      if (hover != null) {
        if (position > meta.startIndex && position <= hover) target = -STEP;
        else if (position < meta.startIndex && position >= hover) target = STEP;
      }
      Animated.timing(shiftFor(otherId), { toValue: target, duration: 120, useNativeDriver: false }).start();
    });
  }

  function clearDwell() {
    if (dwellRef.current.timer) clearTimeout(dwellRef.current.timer);
    dwellRef.current.timer = null;
  }

  finishDragRef.current = () => {
    const meta = dragMetaRef.current;
    const nestInto = nestTargetRef.current;
    dragMetaRef.current = null;
    nestTargetRef.current = null;
    clearDwell();
    Object.values(shiftsRef.current).forEach((v) => v.setValue(0));
    dragY.setValue(0);
    setActiveId(null);
    setNestTargetId(null);
    if (!meta) return;

    if (nestInto) {
      moveCategory(meta.id, listTypeRef.current, nestInto).catch((err) => {
        Alert.alert(t('common.error'), err.response?.data?.error || t('lists.moveFailed'));
      });
      return;
    }

    if (meta.hover === meta.startIndex) return;
    const ids = [...folderIdsRef.current];
    const [moved] = ids.splice(meta.startIndex, 1);
    ids.splice(meta.hover, 0, moved);
    reorderCategories(listTypeRef.current, ids).catch(() => {
      Alert.alert(t('common.error'), t('wishlist.saveFailed'));
    });
  };

  function responderFor(id) {
    if (!respondersRef.current[id]) {
      respondersRef.current[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const ids = folderIdsRef.current;
          const startIndex = ids.indexOf(id);
          if (startIndex === -1) return;
          // A folder that already has subfolders cannot become one itself —
          // that is the two-level rule, and the server enforces it too. Such a
          // folder simply never enters nesting mode, so the gesture stays a
          // plain reorder instead of offering a drop that would be rejected.
          dragMetaRef.current = {
            id,
            startIndex,
            hover: startIndex,
            canNest: !categoriesRef.current.some((c) => c.parent === id),
          };
          dwellRef.current = { timer: null, index: startIndex, dy: 0 };
          dragY.setValue(0);
          setActiveId(id);
        },
        onPanResponderMove: (_, gesture) => {
          const meta = dragMetaRef.current;
          if (!meta) return;
          dragY.setValue(gesture.dy);
          const ids = folderIdsRef.current;
          const hover = clamp(meta.startIndex + Math.round(gesture.dy / STEP), 0, ids.length - 1);

          // Any real movement cancels a pending or active drop: the finger
          // travelling through a folder on its way somewhere else must not be
          // read as an intent to drop into it.
          if (Math.abs(gesture.dy - dwellRef.current.dy) > DWELL_TOLERANCE) {
            dwellRef.current.dy = gesture.dy;
            clearDwell();
            if (nestTargetRef.current) {
              nestTargetRef.current = null;
              setNestTargetId(null);
              applyShifts(meta, hover);
            }
          }

          if (hover !== meta.hover) {
            meta.hover = hover;
            clearDwell();
            if (!nestTargetRef.current) applyShifts(meta, hover);
          }

          // Holding still over another folder arms the drop. Half a second is
          // long enough that passing over cannot trigger it, short enough that
          // deliberately pausing feels answered.
          if (meta.canNest && hover !== meta.startIndex && !nestTargetRef.current && !dwellRef.current.timer) {
            const targetId = ids[hover];
            dwellRef.current.timer = setTimeout(() => {
              dwellRef.current.timer = null;
              if (!dragMetaRef.current) return;
              nestTargetRef.current = targetId;
              setNestTargetId(targetId);
              // Close the insertion gap: the list is no longer making room,
              // it is offering a destination.
              applyShifts(dragMetaRef.current, null);
            }, DWELL_MS);
          }
        },
        onPanResponderRelease: () => finishDragRef.current(),
        onPanResponderTerminate: () => finishDragRef.current(),
      });
    }
    return respondersRef.current[id];
  }

  // ---- helpers -----------------------------------------------------------
  function subtreeIds(folderId) {
    const ids = [folderId];
    let frontier = [folderId];
    while (frontier.length > 0) {
      const children = categories.filter((c) => frontier.includes(c.parent)).map((c) => c._id);
      ids.push(...children);
      frontier = children;
    }
    return ids;
  }

  function statsFor(folder) {
    const ids = subtreeIds(folder._id);
    const items = allItems.filter((i) => ids.includes(i.category));
    const purchased = items.filter((i) => i.purchased).length;
    const subCount = categories.filter((c) => c.parent === folder._id).length;
    return { total: items.length, purchased, subCount };
  }

  async function handleAdd() {
    if (!newName.trim()) {
      // Inline, next to the field it's about — a popup here would hide the
      // very input the user needs to fix.
      setNameError(t('validation.folderNameRequired'));
      nameInputRef.current?.focus();
      return;
    }
    setNameError('');
    setSubmitting(true);
    try {
      await addCategory(listType, newName.trim());
      setNewName('');
    } catch (err) {
      setNameError(err.response?.data?.error || t('manageCategories.duplicateError'));
      nameInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteFolder(target) {
    // Say how much is about to disappear — "this will also delete everything
    // inside" reads the same for an empty folder and for one with 30 tasks.
    const message =
      target.itemCount > 0
        ? t('lists.deleteFolderMessageCount', { count: target.itemCount })
        : t('lists.deleteFolderMessage');
    Alert.alert(t('wishlist.deleteFolderConfirmTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCategory(target.id, listType) },
    ]);
  }

  function openFolderActions(folder) {
    const { total } = statsFor(folder);
    setActionTarget({
      kind: 'folder',
      id: folder._id,
      name: folder.name,
      parent: folder.parent ?? null,
      hasChildren: categories.some((c) => c.parent === folder._id),
      itemCount: total,
    });
  }

  // ---- flattened To-Do view ----------------------------------------------
  function folderPath(categoryId) {
    const folder = categories.find((c) => c._id === categoryId);
    if (!folder) return t('lists.uncategorised');
    const parent = folder.parent ? categories.find((c) => c._id === folder.parent) : null;
    return parent ? `${parent.name} › ${folder.name}` : folder.name;
  }

  const openTaskGroups = (() => {
    if (listType !== 'todo' || todoView !== 'all') return [];
    const folderIds = new Set(categories.map((c) => c._id));
    const open = allItems.filter((i) => !i.purchased && folderIds.has(i.category));
    const byFolder = new Map();
    for (const item of open) {
      if (!byFolder.has(item.category)) byFolder.set(item.category, []);
      byFolder.get(item.category).push(item);
    }
    return [...byFolder.entries()]
      .map(([categoryId, items]) => ({
        categoryId,
        label: folderPath(categoryId),
        items: items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  // Optimistic: the checkbox must respond to the tap, not to the round trip.
  async function toggleTask(item) {
    const next = !item.purchased;
    setAllItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, purchased: next } : i)));
    try {
      await client.put(`/wishlist/items/${item._id}`, { purchased: next });
    } catch (err) {
      setAllItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, purchased: !next } : i)));
      Alert.alert(t('common.error'), t('wishlist.saveFailed'));
    }
  }

  const summaryKey = listType === 'wishlist' ? 'wishlist.folderSummary' : 'todo.folderSummary';
  const folderIcon = listType === 'wishlist' ? 'gift-outline' : 'checkbox-outline';

  return (
    <Screen title={t('nav.wishlist')} showBack={false}>
      <View style={{ flex: 1 }}>
        <View style={styles.segmentRow}>
          {[
            { key: 'wishlist', label: t('wishlist.segmentWishlist'), icon: 'gift-outline' },
            { key: 'todo', label: t('wishlist.segmentTodo'), icon: 'checkbox-outline' },
          ].map((seg) => (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, listType === seg.key && { backgroundColor: theme.primary }]}
              onPress={() => setListType(seg.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={seg.icon} size={15} color={listType === seg.key ? '#fff' : theme.textSecondary} />
              <Text style={[styles.segmentText, listType === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {listType === 'todo' && (
          <View style={styles.viewToggleRow}>
            {[
              { key: 'all', label: t('lists.allTasks'), icon: 'list-outline' },
              { key: 'folders', label: t('lists.byFolder'), icon: 'folder-outline' },
            ].map((view) => {
              const active = todoView === view.key;
              return (
                <TouchableOpacity
                  key={view.key}
                  style={[styles.viewToggle, active && { backgroundColor: hexToRgba(theme.primary, 0.14), borderColor: theme.primary }]}
                  onPress={() => setTodoView(view.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={view.icon} size={14} color={active ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.viewToggleText, active && { color: theme.primary, fontWeight: '700' }]}>
                    {view.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!(listType === 'todo' && todoView === 'all') && (
        <View style={styles.addSection}>
          <View style={styles.addRow}>
            <TextInput
              ref={nameInputRef}
              style={[styles.input, !!nameError && styles.inputError]}
              placeholder={listType === 'wishlist' ? t('wishlist.folderNamePlaceholder') : t('todo.folderNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={newName}
              onChangeText={(v) => {
                setNewName(v);
                if (nameError) setNameError('');
              }}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={submitting}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <FormError message={nameError} />
        </View>
        )}

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!activeId}
        >
          {listType === 'todo' && todoView === 'all' ? (
            openTaskGroups.length === 0 ? (
              <Text style={styles.emptyText}>{t('lists.allTasksEmpty')}</Text>
            ) : (
              openTaskGroups.map((group) => (
                <View key={group.categoryId} style={styles.taskGroup}>
                  <Text style={styles.taskGroupLabel} numberOfLines={1}>
                    {group.label}
                  </Text>
                  {group.items.map((item) => (
                    <TouchableOpacity
                      key={item._id}
                      style={styles.taskRow}
                      onPress={() => toggleTask(item)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.taskCheckbox} />
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )
          ) : (
            <>
          {rootFolders.length === 0 && (
            <Text style={styles.emptyText}>
              {listType === 'wishlist' ? t('wishlist.noneYet') : t('todo.noneYet')}
            </Text>
          )}
          {rootFolders.map((item) => {
            const { total, purchased, subCount } = statsFor(item);
            const progress = total > 0 ? purchased / total : 0;
            const isActive = activeId === item._id;
            const isNestTarget = nestTargetId === item._id;
            return (
              <Animated.View
                key={item._id}
                style={[
                  styles.folderCard,
                  isNestTarget && {
                    borderColor: theme.primary,
                    borderWidth: 2,
                    backgroundColor: hexToRgba(theme.primary, 0.12),
                  },
                  { transform: isActive ? [{ translateY: dragY }, { scale: 1.02 }] : [{ translateY: shiftFor(item._id) }] },
                  isActive && {
                    zIndex: 10,
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.folderTouchable}
                  onPress={() => navigation.navigate('WishlistFolder', { folder: item })}
                  onLongPress={() => openFolderActions(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderIconWrap}>
                    <Ionicons name={folderIcon} size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                    {isNestTarget ? (
                      <Text style={styles.nestHint} numberOfLines={1}>
                        {t('lists.dropInside')}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.folderSummary} numberOfLines={1}>
                          {t(summaryKey, { total, purchased })}
                          {subCount > 0 ? ` · ${subCount} 📁` : ''}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                        </View>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
                {/* Long press opens the same sheet, but a gesture nobody can
                    see is a feature nobody finds — this is the discoverable
                    way in. */}
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => openFolderActions(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={19} color={theme.textSecondary} />
                </TouchableOpacity>
                <View {...responderFor(item._id).panHandlers} style={styles.dragHandle}>
                  <Ionicons name="reorder-three-outline" size={24} color={theme.textSecondary} />
                </View>
              </Animated.View>
            );
          })}
            </>
          )}
        </ScrollView>
      </View>

      <ListActions
        target={actionTarget}
        folders={categories}
        onClose={() => setActionTarget(null)}
        onRename={(target, name) => renameCategory(target.id, listType, name)}
        onMove={(target, parent) => moveCategory(target.id, listType, parent)}
        onDelete={handleDeleteFolder}
      />
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 3,
      marginHorizontal: 16,
      marginTop: 12,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
    },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    segmentTextActive: { color: '#fff' },
    addSection: { padding: 16 },
    viewToggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    viewToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
    },
    viewToggleText: { fontSize: 12, color: theme.textSecondary },
    taskGroup: { marginTop: 16 },
    taskGroupLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 7,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingVertical: 13,
      paddingHorizontal: 13,
      marginBottom: 6,
    },
    taskCheckbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.border,
    },
    taskTitle: { flex: 1, fontSize: 14, color: theme.text },
    moreButton: { paddingHorizontal: 6, paddingVertical: 8 },
    nestHint: { fontSize: 12, color: theme.primary, fontWeight: '700', marginTop: 2 },
    addRow: { flexDirection: 'row', gap: 8 },
    inputError: { borderColor: theme.danger, borderWidth: 1.5 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      flex: 1,
      backgroundColor: theme.surface,
      color: theme.text,
    },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    folderCard: {
      height: FOLDER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      marginBottom: FOLDER_GAP,
      paddingRight: 4,
    },
    folderTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: '100%',
      paddingLeft: 14,
      gap: 12,
    },
    folderIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: hexToRgba(theme.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderName: { fontSize: 15, fontWeight: '700', color: theme.text },
    folderSummary: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: hexToRgba(theme.primary, 0.15),
      overflow: 'hidden',
      marginTop: 8,
      marginRight: 8,
    },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: theme.primary },
    dragHandle: { paddingVertical: 12, paddingHorizontal: 10 },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
