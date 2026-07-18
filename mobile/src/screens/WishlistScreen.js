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

const FOLDER_HEIGHT = 84;
const FOLDER_GAP = 10;
const STEP = FOLDER_HEIGHT + FOLDER_GAP;

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
  const { wishlistCategories, todoCategories, addCategory, deleteCategory, reorderCategories } = useCategories();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  // 'wishlist' | 'todo' — which list type the tab shows.
  const [listType, setListType] = useState('wishlist');
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [allItems, setAllItems] = useState([]);

  // ---- drag machinery (refs + Animated only; no re-render mid-gesture) ----
  const [activeId, setActiveId] = useState(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const respondersRef = useRef({});
  const shiftsRef = useRef({});
  const folderIdsRef = useRef([]);
  const dragMetaRef = useRef(null);
  const finishDragRef = useRef(() => {});
  const listTypeRef = useRef(listType);
  listTypeRef.current = listType;

  const categories = listType === 'wishlist' ? wishlistCategories : todoCategories;
  const rootFolders = categories.filter((c) => !c.parent).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  folderIdsRef.current = rootFolders.map((c) => c._id);

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

  finishDragRef.current = () => {
    const meta = dragMetaRef.current;
    dragMetaRef.current = null;
    Object.values(shiftsRef.current).forEach((v) => v.setValue(0));
    dragY.setValue(0);
    setActiveId(null);
    if (!meta || meta.hover === meta.startIndex) return;
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
          dragY.setValue(0);
          setActiveId(id);
        },
        onPanResponderMove: (_, gesture) => {
          const meta = dragMetaRef.current;
          if (!meta) return;
          dragY.setValue(gesture.dy);
          const ids = folderIdsRef.current;
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
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await addCategory(listType, newName.trim());
      setNewName('');
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('manageCategories.duplicateError'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteFolder(folder) {
    Alert.alert(t('wishlist.deleteFolderConfirmTitle'), t('wishlist.deleteFolderConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCategory(folder._id, listType) },
    ]);
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

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder={listType === 'wishlist' ? t('wishlist.folderNamePlaceholder') : t('todo.folderNamePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={submitting}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!activeId}
        >
          {rootFolders.length === 0 && (
            <Text style={styles.emptyText}>
              {listType === 'wishlist' ? t('wishlist.noneYet') : t('todo.noneYet')}
            </Text>
          )}
          {rootFolders.map((item) => {
            const { total, purchased, subCount } = statsFor(item);
            const progress = total > 0 ? purchased / total : 0;
            const isActive = activeId === item._id;
            return (
              <Animated.View
                key={item._id}
                style={[
                  styles.folderCard,
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
                  onLongPress={() => handleDeleteFolder(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderIconWrap}>
                    <Ionicons name={folderIcon} size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.folderSummary} numberOfLines={1}>
                      {t(summaryKey, { total, purchased })}
                      {subCount > 0 ? ` · ${subCount} 📁` : ''}
                    </Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>
                <View {...responderFor(item._id).panHandlers} style={styles.dragHandle}>
                  <Ionicons name="reorder-three-outline" size={24} color={theme.textSecondary} />
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>
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
    addRow: { flexDirection: 'row', padding: 16, gap: 8 },
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
