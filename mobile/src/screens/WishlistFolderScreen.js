import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TextInput,
  Animated,
  PanResponder,
  LayoutAnimation,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useCategories } from '../context/CategoriesContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { getPersonColor } from '../utils/personColor';

const ROW_HEIGHT = 58;
const ROW_GAP = 8;
const STEP = ROW_HEIGHT + ROW_GAP;

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

function animateLayout() {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
  } catch (e) {
    // Layout animation is a nice-to-have; never let it break a toggle.
  }
}

export default function WishlistFolderScreen({ route, navigation }) {
  const { folder } = route.params;
  const { t, formatAmount } = useSettings();
  const { wishlistCategories, todoCategories, addCategory, deleteCategory } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [items, setItems] = useState([]);
  const [showSubfolderInput, setShowSubfolderInput] = useState(false);
  const [subfolderName, setSubfolderName] = useState('');

  // ---- drag machinery ----------------------------------------------------
  // The drag is driven entirely by refs + Animated values: NO re-render
  // happens while the finger moves. Re-creating PanResponders or setting
  // state mid-gesture resets the responder and makes the row glitch/stick.
  const [activeId, setActiveId] = useState(null); // re-render only on grant/release
  const dragY = useRef(new Animated.Value(0)).current;
  const respondersRef = useRef({});
  const shiftsRef = useRef({});
  const uncheckedIdsRef = useRef([]);
  const dragMetaRef = useRef(null); // { id, startIndex, hover }
  const finishDragRef = useRef(() => {});

  // To-Do folders reuse this whole screen; only labels differ.
  const isTodo = folder.scope === 'todo';
  const siblingSource = isTodo ? todoCategories : wishlistCategories;
  const subfolders = siblingSource.filter((c) => c.parent === folder._id);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/wishlist/items', { params: { category: folder._id } });
      setItems(res.data.items);
    } catch (err) {
      console.log('Failed to load wishlist items:', err.message);
    }
  }, [folder._id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unchecked = items.filter((i) => !i.purchased).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const purchased = items
    .filter((i) => i.purchased)
    .sort((a, b) => new Date(b.purchasedAt || b.updatedAt || 0) - new Date(a.purchasedAt || a.updatedAt || 0));
  uncheckedIdsRef.current = unchecked.map((i) => i._id);

  const total = items.length;
  const doneCount = purchased.length;
  const progress = total > 0 ? doneCount / total : 0;

  function shiftFor(id) {
    if (!shiftsRef.current[id]) shiftsRef.current[id] = new Animated.Value(0);
    return shiftsRef.current[id];
  }

  finishDragRef.current = () => {
    const meta = dragMetaRef.current;
    dragMetaRef.current = null;
    Object.values(shiftsRef.current).forEach((v) => v.setValue(0));
    dragY.setValue(0);
    setActiveId(null);
    if (!meta || meta.hover === meta.startIndex) return;
    const ids = [...uncheckedIdsRef.current];
    const [moved] = ids.splice(meta.startIndex, 1);
    ids.splice(meta.hover, 0, moved);
    const orderById = {};
    ids.forEach((id, i) => {
      orderById[id] = i;
    });
    setItems((prev) => prev.map((i) => (orderById[i._id] != null ? { ...i, order: orderById[i._id] } : i)));
    client.put('/wishlist/items/reorder', { ids }).catch(() => {
      Alert.alert(t('common.error'), t('wishlist.saveFailed'));
      load();
    });
  };

  function responderFor(id) {
    if (!respondersRef.current[id]) {
      respondersRef.current[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Never let the surrounding ScrollView steal the gesture mid-drag.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const ids = uncheckedIdsRef.current;
          const startIndex = ids.indexOf(id);
          if (startIndex === -1) return;
          dragMetaRef.current = { id, startIndex, hover: startIndex };
          dragY.setValue(0);
          setActiveId(id);
        },
        onPanResponderMove: (_, gesture) => {
          const meta = dragMetaRef.current;
          if (!meta) return;
          dragY.setValue(gesture.dy);
          const ids = uncheckedIdsRef.current;
          // Clamped to the unchecked section — dragging into "purchased"
          // territory just snaps back to the last unchecked position.
          const hover = clamp(meta.startIndex + Math.round(gesture.dy / STEP), 0, ids.length - 1);
          if (hover === meta.hover) return;
          meta.hover = hover;
          ids.forEach((otherId, position) => {
            if (otherId === meta.id) return;
            let target = 0;
            if (position > meta.startIndex && position <= hover) target = -STEP;
            else if (position < meta.startIndex && position >= hover) target = STEP;
            Animated.timing(shiftFor(otherId), { toValue: target, duration: 120, useNativeDriver: false }).start();
          });
        },
        onPanResponderRelease: () => finishDragRef.current(),
        onPanResponderTerminate: () => finishDragRef.current(),
      });
    }
    return respondersRef.current[id];
  }

  // ---- optimistic toggle -------------------------------------------------
  function togglePurchased(item) {
    const next = !item.purchased;
    const maxOrder = unchecked.reduce((max, i) => Math.max(max, i.order ?? 0), -1);
    animateLayout();
    setItems((prev) =>
      prev.map((i) =>
        i._id === item._id
          ? { ...i, purchased: next, purchasedAt: next ? new Date().toISOString() : null, order: next ? i.order : maxOrder + 1 }
          : i
      )
    );
    client.put(`/wishlist/items/${item._id}`, { purchased: next }).catch(() => {
      animateLayout();
      setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, purchased: !next } : i)));
      Alert.alert(t('common.error'), t('wishlist.saveFailed'));
    });
  }

  // ---- other actions -----------------------------------------------------
  function handleDelete(item) {
    Alert.alert(t('common.delete'), t('wishlist.deleteItemConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          animateLayout();
          setItems((prev) => prev.filter((i) => i._id !== item._id));
          try {
            await client.delete(`/wishlist/items/${item._id}`);
          } catch {
            load();
          }
        },
      },
    ]);
  }

  async function handleAddSubfolder() {
    const name = subfolderName.trim();
    if (!name) return;
    try {
      await addCategory(folder.scope || 'wishlist', name, folder._id);
      setSubfolderName('');
      setShowSubfolderInput(false);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('manageCategories.duplicateError'));
    }
  }

  function handleDeleteSubfolder(sub) {
    Alert.alert(t('wishlist.deleteFolderConfirmTitle'), t('wishlist.deleteFolderConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCategory(sub._id, folder.scope || 'wishlist') },
    ]);
  }

  // ---- row renderer ------------------------------------------------------
  function renderRow(item, isPurchasedRow) {
    const personColor = getPersonColor(item.addedBy?.name);
    const isActive = !isPurchasedRow && activeId === item._id;
    const hasSubtitle = item.price != null || !!item.notes;

    let transform;
    if (isActive) transform = [{ translateY: dragY }, { scale: 1.03 }];
    else if (!isPurchasedRow) transform = [{ translateY: shiftFor(item._id) }];
    else transform = [];

    return (
      <Animated.View
        key={item._id}
        style={[
          styles.row,
          { borderLeftColor: personColor },
          isPurchasedRow && styles.rowPurchased,
          { transform },
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
          style={styles.rowTouchable}
          activeOpacity={0.6}
          onPress={() => togglePurchased(item)}
          onLongPress={() => handleDelete(item)}
          delayLongPress={450}
        >
          <View style={[styles.checkbox, item.purchased && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
            {item.purchased && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, item.purchased && styles.itemTitlePurchased]} numberOfLines={1}>
              {item.title}
            </Text>
            {hasSubtitle && (
              <Text style={styles.itemSub} numberOfLines={1}>
                {item.price != null && (
                  <Text style={styles.itemPrice}>{formatAmount(item.price, item.currency)}</Text>
                )}
                {item.price != null && item.notes ? '  ·  ' : ''}
                {item.notes || ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {!!item.link && (
          <TouchableOpacity style={styles.iconButton} onPress={() => Linking.openURL(item.link)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Ionicons name="open-outline" size={19} color={theme.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('WishlistItemForm', { folder, item })}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="pencil-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        {!isPurchasedRow && (
          <View {...responderFor(item._id).panHandlers} style={styles.dragHandle}>
            <Ionicons name="reorder-three-outline" size={24} color={theme.textSecondary} />
          </View>
        )}
      </Animated.View>
    );
  }

  return (
    <Screen title={folder.name}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }} scrollEnabled={!activeId}>
          {total > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>
                  {t(isTodo ? 'todo.progressLabel' : 'wishlist.progressLabel', { purchased: doneCount, total })}
                </Text>
                <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            </View>
          )}

          {subfolders.length > 0 && (
            <View style={styles.subfolderWrap}>
              {subfolders.map((sub) => (
                <TouchableOpacity
                  key={sub._id}
                  style={styles.subfolderChip}
                  onPress={() => navigation.push('WishlistFolder', { folder: sub })}
                  onLongPress={() => handleDeleteSubfolder(sub)}
                >
                  <Ionicons name="folder-outline" size={15} color={theme.primary} />
                  <Text style={styles.subfolderName} numberOfLines={1}>{sub.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showSubfolderInput ? (
            <View style={styles.subfolderInputRow}>
              <TextInput
                style={styles.subfolderInput}
                placeholder={t('wishlist.subfolderNamePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={subfolderName}
                onChangeText={setSubfolderName}
                autoFocus
                onSubmitEditing={handleAddSubfolder}
              />
              <TouchableOpacity style={styles.subfolderAddButton} onPress={handleAddSubfolder}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subfolderCancelButton}
                onPress={() => {
                  setShowSubfolderInput(false);
                  setSubfolderName('');
                }}
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addSubfolderLink} onPress={() => setShowSubfolderInput(true)}>
              <Ionicons name="add" size={15} color={theme.primary} />
              <Text style={styles.addSubfolderText}>{t('wishlist.addSubfolder')}</Text>
            </TouchableOpacity>
          )}

          {total === 0 && subfolders.length === 0 && (
            <Text style={styles.emptyText}>{t(isTodo ? 'todo.emptyFolder' : 'wishlist.emptyFolder')}</Text>
          )}

          <View>{unchecked.map((item) => renderRow(item, false))}</View>

          {purchased.length > 0 && (
            <>
              <View style={styles.purchasedHeader}>
                <Text style={styles.purchasedHeaderText}>
                  {t(isTodo ? 'todo.doneSection' : 'wishlist.purchasedSection')} · {purchased.length}
                </Text>
                <View style={styles.purchasedHeaderLine} />
              </View>
              <View>{purchased.map((item) => renderRow(item, true))}</View>
            </>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('WishlistItemForm', { folder })}>
          <Text style={styles.addButtonText}>{t(isTodo ? 'todo.addItem' : 'wishlist.addItem')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    progressCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 13, color: theme.textSecondary },
    progressPct: { fontSize: 13, fontWeight: '700', color: theme.primary },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: hexToRgba(theme.primary, 0.15),
      overflow: 'hidden',
    },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: theme.primary },
    subfolderWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    subfolderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.surface,
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: hexToRgba(theme.primary, 0.25),
      maxWidth: '48%',
    },
    subfolderName: { fontSize: 13, fontWeight: '600', color: theme.text },
    addSubfolderLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      paddingVertical: 4,
      marginBottom: 10,
    },
    addSubfolderText: { fontSize: 13, color: theme.primary, fontWeight: '600' },
    subfolderInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    subfolderInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    subfolderAddButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      padding: 9,
    },
    subfolderCancelButton: { padding: 9 },
    row: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderLeftWidth: 3,
      marginBottom: ROW_GAP,
      paddingRight: 4,
    },
    rowPurchased: { opacity: 0.55 },
    rowTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: '100%',
      paddingLeft: 12,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: theme.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    itemTitlePurchased: { textDecorationLine: 'line-through', color: theme.textSecondary, fontWeight: '400' },
    itemSub: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
    itemPrice: { fontSize: 12, color: theme.primary, fontWeight: '600' },
    iconButton: { padding: 8 },
    dragHandle: { paddingVertical: 8, paddingHorizontal: 10 },
    purchasedHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 10 },
    purchasedHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginRight: 10,
    },
    purchasedHeaderLine: { flex: 1, height: 1, backgroundColor: theme.border },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 15,
      margin: 16,
      marginTop: 8,
      alignItems: 'center',
    },
    addButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  });
}
