import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Animated, PanResponder, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getPersonColor } from '../utils/personColor';
import { formatLongDate, formatTime } from '../i18n/dateFormat';

const ROW_HEIGHT = 62;
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

function localDayString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AgendaScreen({ navigation }) {
  const { t, language } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'past' | 'all'

  // Drag state for all-day entries only — timed entries are ordered by the
  // clock, so letting them be dragged would show an order that isn't real.
  const [activeId, setActiveId] = useState(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const respondersRef = useRef({});
  const shiftsRef = useRef({});
  const dragGroupRef = useRef([]);
  const dragMetaRef = useRef(null);
  const finishDragRef = useRef(() => {});

  const load = useCallback(async () => {
    try {
      const res = await client.get('/events');
      setEvents(res.data.events);
    } catch (err) {
      console.log('Failed to load agenda:', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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
    const ids = [...dragGroupRef.current];
    const [moved] = ids.splice(meta.startIndex, 1);
    ids.splice(meta.hover, 0, moved);
    const orderById = {};
    ids.forEach((id, i) => {
      orderById[id] = i;
    });
    setEvents((prev) => prev.map((e) => (orderById[e._id] != null ? { ...e, order: orderById[e._id] } : e)));
    client.put('/events/reorder', { ids }).catch(() => {
      Alert.alert(t('common.error'), t('wishlist.saveFailed'));
      load();
    });
  };

  function responderFor(id, siblingIds) {
    if (!respondersRef.current[id]) {
      respondersRef.current[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          // Snapshot the sibling group at grab time so the gesture math is
          // stable even as the list re-renders around it.
          dragGroupRef.current = respondersRef.current[id].__siblings || [];
          const startIndex = dragGroupRef.current.indexOf(id);
          if (startIndex === -1) return;
          dragMetaRef.current = { id, startIndex, hover: startIndex };
          dragY.setValue(0);
          setActiveId(id);
        },
        onPanResponderMove: (_, gesture) => {
          const meta = dragMetaRef.current;
          if (!meta) return;
          dragY.setValue(gesture.dy);
          const ids = dragGroupRef.current;
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
    // Keep the sibling list fresh without rebuilding the responder itself.
    respondersRef.current[id].__siblings = siblingIds;
    return respondersRef.current[id];
  }

  // ---- grouping ----------------------------------------------------------
  const todayStr = localDayString(new Date());

  const visible = events.filter((e) => {
    const day = e.date.slice(0, 10);
    if (filter === 'upcoming') return day >= todayStr;
    if (filter === 'past') return day < todayStr;
    return true;
  });

  const byDay = {};
  for (const e of visible) {
    const day = e.date.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

  const dayKeys = Object.keys(byDay).sort();
  if (filter === 'past') dayKeys.reverse(); // most recent past day first

  const sections = dayKeys.map((day) => {
    const all = byDay[day];
    // All-day entries first (manual order), then timed ones by the clock.
    const allDay = all.filter((e) => !e.startTime).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const timed = all.filter((e) => e.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return { day, allDayIds: allDay.map((e) => e._id), data: [...allDay, ...timed] };
  });

  function dayLabel(day) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (day === localDayString(today)) return t('agenda.today');
    if (day === localDayString(tomorrow)) return t('agenda.tomorrow');
    if (day === localDayString(yesterday)) return t('agenda.yesterday');
    return null;
  }

  // ---- render ------------------------------------------------------------
  function renderItem({ item, section }) {
    const color = getPersonColor(item.owner?.name);
    const isAllDay = !item.startTime;
    const isActive = activeId === item._id;
    const hasReminder = item.reminderEnabled && item.reminderAt;

    let transform;
    if (isActive) transform = [{ translateY: dragY }, { scale: 1.02 }];
    else if (isAllDay) transform = [{ translateY: shiftFor(item._id) }];
    else transform = [];

    return (
      <Animated.View
        style={[
          styles.row,
          { borderLeftColor: color, transform },
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
          activeOpacity={0.7}
          onPress={() => navigation.navigate('EventForm', { date: item.date.slice(0, 10), eventId: item._id })}
        >
          <View style={styles.timeCol}>
            {isAllDay ? (
              <Text style={styles.allDayText}>{t('agenda.allDayShort')}</Text>
            ) : (
              <Text style={styles.timeText}>{item.startTime}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <View style={styles.metaRow}>
              {hasReminder && (
                <Ionicons name="notifications-outline" size={11} color={theme.primary} style={{ marginRight: 3 }} />
              )}
              <Text style={styles.meta} numberOfLines={1}>
                {hasReminder ? `${formatTime(new Date(item.reminderAt))} · ` : ''}
                {item.type}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {isAllDay && section.allDayIds.length > 1 && (
          <View {...responderFor(item._id, section.allDayIds).panHandlers} style={styles.dragHandle}>
            <Ionicons name="reorder-three-outline" size={22} color={theme.textSecondary} />
          </View>
        )}
      </Animated.View>
    );
  }

  const emptyText = filter === 'past' ? t('agenda.emptyPast') : t('agenda.emptyUpcoming');

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {[
          { key: 'upcoming', label: t('agenda.upcoming') },
          { key: 'past', label: t('agenda.past') },
          { key: 'all', label: t('agenda.all') },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key && { borderColor: theme.primary, backgroundColor: hexToRgba(theme.primary, 0.12) },
            ]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f.key && { color: theme.primary, fontWeight: '700' }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled
        scrollEnabled={!activeId}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
        renderSectionHeader={({ section }) => {
          const relative = dayLabel(section.day);
          const isToday = relative === t('agenda.today');
          return (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, isToday && { color: theme.primary }]}>
                {relative || formatLongDate(section.day, language)}
              </Text>
              {relative && <Text style={styles.sectionDate}>{formatLongDate(section.day, language)}</Text>}
              <View style={styles.sectionLine} />
            </View>
          );
        }}
        renderItem={renderItem}
      />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // Sits directly under the Calendar/List segment, so no extra top padding.
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    filterChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    filterText: { fontSize: 13, color: theme.textSecondary },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      backgroundColor: theme.background,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionDate: { fontSize: 11, color: theme.textSecondary },
    sectionLine: { flex: 1, height: 1, backgroundColor: theme.border },
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
    rowTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%', paddingLeft: 12 },
    timeCol: { width: 52, alignItems: 'flex-start' },
    timeText: { fontSize: 15, fontWeight: '700', color: theme.text },
    allDayText: { fontSize: 11, color: theme.textSecondary },
    title: { fontSize: 15, fontWeight: '600', color: theme.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    meta: { flex: 1, fontSize: 12, color: theme.textSecondary },
    dragHandle: { paddingVertical: 10, paddingHorizontal: 8 },
    emptyText: { color: theme.textSecondary, textAlign: 'center', marginTop: 60, paddingHorizontal: 24, lineHeight: 20 },
  });
}
