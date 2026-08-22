import React, { useMemo, useCallback, useRef, useState  } from 'react';
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
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useWishlistItems } from '../context/WishlistItemsContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import FormError from '../components/FormError';
import ListActions from '../components/ListActions';
import DuoLoader from '../components/duo/DuoLoader';
import { getPersonColor } from '../utils/personColor';
import { useToast } from '../components/Toast';

const FOLDER_HEIGHT = 84;
const FOLDER_GAP = 10;
const STEP = FOLDER_HEIGHT + FOLDER_GAP;
// The dragged card shrinks so it stops covering the row underneath it.
const DRAG_SCALE = 0.95;
// Dragging within this far of the top or bottom of the screen scrolls the list
// under the finger, so a folder can be carried from the bottom of a long list
// to the top without letting go.
const EDGE_TOP = 170;
const EDGE_BOTTOM = 210;
const EDGE_SPEED = 10; // px per tick
const EDGE_TICK = 16;

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
  const toast = useToast();
  // Id of the row that just appeared, so it can glow briefly — confirmation
  // that names WHICH thing was created, which a message alone cannot.
  const [flashId, setFlashId] = useState(null);
  // 'idle' | 'working' | 'done' — the + button's own state. "working" only
  // ever appears if the request is genuinely slow: the folder itself is
  // already on screen by then, so a spinner over an instant result would be
  // theatre, not information.
  const [addState, setAddState] = useState('idle');
  const listRef = useRef(null);
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
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const { items: allItems, loaded: itemsLoaded, refresh: refreshItems, togglePurchased, dropItemsIn } =
    useWishlistItems();
  const nameInputRef = useRef(null);

  // ---- drag machinery (refs + Animated only; no re-render mid-gesture) ----
  const [activeId, setActiveId] = useState(null);
  const shiftsRef = useRef({});
  // Auto-scroll bookkeeping. The list moving under the finger changes where
  // the card sits in list coordinates, so the scroll delta since the drag
  // began has to be added back in or the drop lands on the wrong row.
  const scrollYRef = useRef(0);
  const grantScrollYRef = useRef(0);
  const lastDyRef = useRef(0);
  const autoScrollRef = useRef(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const respondersRef = useRef({});
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

  // The cache is shared with the folder screen, so returning here costs
  // nothing: what is already loaded renders at once and the refresh happens
  // behind it.
  useFocusEffect(
    useCallback(() => {
      refreshItems();
    }, [refreshItems])
  );

  function shiftFor(id) {
    if (!shiftsRef.current[id]) shiftsRef.current[id] = new Animated.Value(0);
    return shiftsRef.current[id];
  }

  // Rows step aside to open a gap where the card would land — the list shows
  // the outcome rather than describing it.
  function applyShifts(meta, hover) {
    folderIdsRef.current.forEach((otherId, position) => {
      if (otherId === meta.id) return;
      let target = 0;
      if (position > meta.startIndex && position <= hover) target = -STEP;
      else if (position < meta.startIndex && position >= hover) target = STEP;
      Animated.timing(shiftFor(otherId), { toValue: target, duration: 130, useNativeDriver: true }).start();
    });
  }

  function stopAutoScroll() {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    autoScrollRef.current = null;
  }

  // Recomputed from the finger AND the scroll position, so carrying a card
  // while the list slides underneath still targets the row you can see.
  function updateHover() {
    const meta = dragMetaRef.current;
    if (!meta) return;
    const scrolled = scrollYRef.current - grantScrollYRef.current;
    const center = meta.startIndex * STEP + FOLDER_HEIGHT / 2 + lastDyRef.current + scrolled;
    const row = clamp(Math.floor(center / STEP), 0, folderIdsRef.current.length - 1);
    if (row === meta.hover) return;
    meta.hover = row;
    applyShifts(meta, row);
  }

  function maybeAutoScroll(touchY) {
    const { height } = Dimensions.get('window');
    const direction = touchY < EDGE_TOP ? -1 : touchY > height - EDGE_BOTTOM ? 1 : 0;
    if (direction === 0) {
      stopAutoScroll();
      return;
    }
    if (autoScrollRef.current) return;
    autoScrollRef.current = setInterval(() => {
      const next = Math.max(0, scrollYRef.current + direction * EDGE_SPEED);
      if (next === scrollYRef.current) return; // already at the top
      listRef.current?.scrollTo({ y: next, animated: false });
      updateHover();
    }, EDGE_TICK);
  }

  finishDragRef.current = () => {
    const meta = dragMetaRef.current;
    dragMetaRef.current = null;
    stopAutoScroll();
    Object.values(shiftsRef.current).forEach((v) => v.setValue(0));
    dragY.setValue(0);
    setActiveId(null);
    if (!meta) return;
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
          dragMetaRef.current = { id, startIndex, hover: startIndex };
          grantScrollYRef.current = scrollYRef.current;
          lastDyRef.current = 0;
          dragY.setValue(0);
          setActiveId(id);
        },
        onPanResponderMove: (_, gesture) => {
          const meta = dragMetaRef.current;
          if (!meta) return;
          lastDyRef.current = gesture.dy;
          // The card follows the finger AND the scroll, so it stays under the
          // thumb while the list travels.
          dragY.setValue(gesture.dy + (scrollYRef.current - grantScrollYRef.current));
          updateHover();
          maybeAutoScroll(gesture.moveY);
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
    const name = newName.trim();
    if (!name) {
      // Inline, next to the field it's about — a popup here would hide the
      // very input the user needs to fix.
      setNameError(t('validation.folderNameRequired'));
      nameInputRef.current?.focus();
      return;
    }
    setNameError('');
    // Cleared before the request, not after: the folder is already on screen
    // by then, and leaving the text sitting there reads as "nothing happened".
    setNewName('');
    // Only claim to be working if the wait becomes noticeable.
    const slowTimer = setTimeout(() => setAddState('working'), 400);
    try {
      const created = await addCategory(listType, name);
      clearTimeout(slowTimer);
      setAddState('done');
      setTimeout(() => setAddState('idle'), 1200);
      setFlashId(created?._id ?? null);
      setTimeout(() => setFlashId(null), 1600);
      // New folders land at the END of the list, which on a long list is
      // below the fold — the row appeared instantly and still looked like
      // nothing had happened. Bring it into view.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      toast.success(t('toast.folderCreated'));
    } catch (err) {
      clearTimeout(slowTimer);
      setAddState('idle');
      setNewName(name);
      const message = err.response?.data?.error || t('toast.saveFailed');
      setNameError(message);
      toast.error(message);
      nameInputRef.current?.focus();
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
      { text: t('common.delete'), style: 'destructive', onPress: () => {
          dropItemsIn(subtreeIds(target.id));
          deleteCategory(target.id, listType)
            .then(() => toast.success(t('toast.folderDeleted')))
            .catch(() => toast.error(t('toast.deleteFailed')));
        },
      },
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

  // The tick lands on the tap; the shared cache owns the round trip and
  // reverts itself if the server refuses.
  function toggleTask(item) {
    togglePurchased(item).catch(() => Alert.alert(t('common.error'), t('wishlist.saveFailed')));
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
            <TouchableOpacity
              style={[styles.addButton, addState === 'done' && { backgroundColor: theme.success }]}
              onPress={handleAdd}
              disabled={addState === 'working'}
            >
              {addState === 'working' ? (
                <DuoLoader size={22} />
              ) : (
                <Ionicons name={addState === 'done' ? 'checkmark' : 'add'} size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <FormError message={nameError} />
        </View>
        )}

        <ScrollView
          ref={listRef}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
                      style={[styles.taskRow, { borderLeftColor: getPersonColor(item.addedBy?.name) }]}
                      onPress={() => toggleTask(item)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.taskCheckbox} />
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={[styles.taskPersonDot, { backgroundColor: getPersonColor(item.addedBy?.name) }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )
          ) : (
            <View style={{ position: 'relative' }}>
          {rootFolders.length === 0 && (
            <Text style={styles.emptyText}>
              {listType === 'wishlist' ? t('wishlist.noneYet') : t('todo.noneYet')}
            </Text>
          )}
          {rootFolders.map((item) => {
            const { total, purchased, subCount } = statsFor(item);
            const progress = total > 0 ? purchased / total : 0;
            const isActive = activeId === item._id;
            const isFlashing = flashId === item._id;
            return (
              <Animated.View
                key={item._id}
                style={[
                  styles.folderCard,
                  isFlashing && { borderColor: theme.success, borderWidth: 2 },
                  isActive
                    ? { transform: [{ translateY: dragY }, { scale: DRAG_SCALE }], opacity: 0.96 }
                    : { transform: [{ translateY: shiftFor(item._id) }] },
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
                    <>
                        <Text style={styles.folderSummary} numberOfLines={1}>
                          {t(summaryKey, { total, purchased })}
                          {subCount > 0 ? ` · ${subCount} 📁` : ''}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                        </View>
                    </>
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
            </View>
          )}
        </ScrollView>
      </View>

      <ListActions
        target={actionTarget}
        folders={categories}
        onClose={() => setActionTarget(null)}
        onRename={async (target, name) => {
          await renameCategory(target.id, listType, name);
          toast.success(t('toast.folderRenamed'));
        }}
        onMove={async (target, parent) => {
          await moveCategory(target.id, listType, parent);
          toast.success(t('toast.folderMoved'));
        }}
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
      borderLeftWidth: 4,
    },
    taskPersonDot: { width: 9, height: 9, borderRadius: 5 },
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
    insertLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.primary,
      zIndex: 5,
    },
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
