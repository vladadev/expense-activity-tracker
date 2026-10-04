import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { usePersonColor } from '../context/PersonColorsContext';
import { matches } from '../utils/search';
import { formatDayHeader } from '../i18n/dateFormat';
import Money from './AmountText';
import { space, radius, type, font, HIT } from '../theme/scale';

const KINDS = ['expense', 'income', 'all'];
const MAX_CHIPS = 8;
const PAGE_SIZE = 100;
const DEBOUNCE_MS = 250;

function localDateString(value) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// expenses/income are the FULL history, not just the visible month. Which of
// the two ranges is actually shown is decided below by `searching`: with no
// query and no category the list stays inside the selected month, and the
// moment either filter is set it searches everything. That is the whole point
// of the feature — you reach for search precisely when you do not know which
// month the thing you are looking for is in.
export default function TransactionsSection({
  expenses,
  income,
  monthFrom,
  monthTo,
  monthLabel,
  ownerName,
  currency,
  onEditExpense,
  onEditIncome,
  onDeleted,
  onSearchFocus,
}) {
  const personColor = usePersonColor();
  const { t, language } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [kind, setKind] = useState('expense');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState(null);
  const [focused, setFocused] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Typing re-filters the whole history on every keystroke otherwise.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const searching = debounced.trim() !== '' || category != null;

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [debounced, category, kind, ownerName, currency]);

  const rows = useMemo(() => {
    const takeExpenses = kind === 'expense' || kind === 'all';
    const takeIncome = (kind === 'income' || kind === 'all') && category == null;

    const pool = [
      ...(takeExpenses
        ? expenses.map((e) => ({
            id: e._id,
            type: 'expense',
            date: localDateString(e.date),
            amount: e.amount,
            currency: e.currency,
            title: e.category,
            subtitle: e.description,
            owner: e.owner?.name,
            raw: e,
          }))
        : []),
      ...(takeIncome
        ? income.map((e) => ({
            id: e._id,
            type: 'income',
            date: localDateString(e.date),
            amount: e.amount,
            currency: e.currency,
            title: t('finance.incomeEntry'),
            subtitle: e.description,
            owner: e.owner?.name,
            raw: e,
          }))
        : []),
    ];

    return pool
      .filter((r) => r.currency === currency)
      .filter((r) => (ownerName ? r.owner === ownerName : true))
      .filter((r) => (searching ? true : r.date >= monthFrom && r.date <= monthTo))
      .filter((r) => (category ? r.title === category : true))
      .filter((r) => matches(debounced, [r.title, r.subtitle, r.owner, r.amount, r.currency]))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses, income, kind, currency, ownerName, searching, monthFrom, monthTo, category, debounced, t]);

  const visible = rows.slice(0, limit);

  // Chips come from the expenses actually available to this person/currency,
  // most-used first, so the shortcuts reflect real spending habits.
  const chips = useMemo(() => {
    const counts = {};
    for (const e of expenses) {
      if (e.currency !== currency) continue;
      if (ownerName && e.owner?.name !== ownerName) continue;
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CHIPS)
      .map(([name]) => name);
  }, [expenses, currency, ownerName]);

  const groups = useMemo(() => {
    const byDay = new Map();
    for (const r of visible) {
      if (!byDay.has(r.date)) byDay.set(r.date, []);
      byDay.get(r.date).push(r);
    }
    return [...byDay.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((sum, r) => sum + (r.type === 'income' ? r.amount : -r.amount), 0),
    }));
  }, [visible]);

  function confirmDelete(row) {
    const message = row.type === 'income' ? t('finance.deleteConfirm') : t('finance.deleteExpenseConfirm');
    Alert.alert(t('common.delete'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => onDeleted(row.type, row.id) },
    ]);
  }

  function clearSearch() {
    setQuery('');
    setDebounced('');
    setCategory(null);
  }

  return (
    <View style={styles.wrap}>
      {/* Full-bleed rule: the parent ScrollView has 16px padding, so the
          negative margin lets the line run edge to edge and read as a real
          break between the month summary above and the entry list below,
          rather than as one more card boundary. */}
      <View style={styles.sectionBreak} />
      <Text style={styles.sectionTitle}>{t('finance.transactionsSection')}</Text>

      <View style={styles.segment}>
        {KINDS.map((k) => {
          const active = kind === k;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.segmentItem, active && { backgroundColor: theme.primary }]}
              onPress={() => setKind(k)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(`finance.filter.${k}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onFocus={() => {
            setFocused(true);
            // This section sits at the bottom of a long page, so without this
            // the keyboard opens straight over the field being typed into.
            // The delay lets the keyboard finish animating first, otherwise
            // the scroll target is computed against the pre-resize layout.
            if (onSearchFocus) setTimeout(onSearchFocus, 250);
          }}
          onBlur={() => setFocused(false)}
          placeholder={t('finance.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {(focused || searching) && (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={15} color={theme.primary} />
          <Text style={styles.hintText}>{t('finance.searchScopeHint')}</Text>
        </View>
      )}

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map((name) => {
            const active = category === name;
            return (
              <TouchableOpacity
                key={name}
                style={[styles.chip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setCategory(active ? null : name)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.scopeLine}>
        {searching
          ? t('finance.searchResults', { count: rows.length })
          : `${monthLabel} · ${t('finance.entryCount', { count: rows.length })}`}
      </Text>

      {groups.length === 0 ? (
        <Text style={styles.emptyText}>{searching ? t('finance.noMatches') : t('finance.noneYet')}</Text>
      ) : (
        groups.map((group) => (
          <View key={group.date}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{formatDayHeader(group.date, language)}</Text>
              <Money
                value={Math.abs(group.total)}
                currency={currency}
                prefix={group.total > 0 ? '+' : ''}
                style={styles.dayHeaderTotal}
              />
            </View>
            {/* One card per day, not a slab per row. A column of separately
                floating rows reads as a list of unrelated things; a day is one
                thing with entries in it. */}
            <View style={styles.dayCard}>
            {group.items.map((row, i) => (
              <TouchableOpacity
                key={`${row.type}-${row.id}`}
                style={[styles.row, { borderLeftColor: personColor(row.owner) }, i > 0 && styles.rowDivided]}
                onPress={() => (row.type === 'expense' ? onEditExpense(row.raw) : onEditIncome(row.raw))}
                onLongPress={() => confirmDelete(row)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  {row.subtitle ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {row.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Money
                  value={row.amount}
                  currency={row.currency}
                  prefix={row.type === 'income' ? '+' : '−'}
                  style={[styles.rowAmount, { color: row.type === 'income' ? theme.success : theme.text }]}
                />
              </TouchableOpacity>
            ))}
            </View>
          </View>
        ))
      )}

      {rows.length > visible.length && (
        <TouchableOpacity style={styles.moreButton} onPress={() => setLimit((l) => l + PAGE_SIZE)} activeOpacity={0.7}>
          <Text style={styles.moreButtonText}>
            {t('finance.showMore', { count: rows.length - visible.length })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { marginTop: space.lg + 4 },
    sectionBreak: {
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: -space.md,
      marginBottom: space.lg - 2,
    },
    sectionTitle: { ...type.label, color: theme.textSecondary, marginBottom: space.sm + 4 },

    segment: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: radius.pill,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      padding: 3,
      marginBottom: space.sm + 2,
    },
    segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: HIT - 12, borderRadius: radius.pill },
    segmentText: { ...type.secondary, color: theme.textSecondary },
    segmentTextActive: { color: theme.isDark ? '#06201A' : '#FFFFFF', fontFamily: font.bodySemiBold },

    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: theme.surface,
      borderRadius: radius.control + 2,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      paddingHorizontal: space.md - 4,
      height: HIT,
    },
    searchInput: { ...type.body, flex: 1, color: theme.text, padding: 0 },

    hintBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.sm - 1,
      marginTop: space.sm,
      padding: space.sm + 2,
      borderRadius: radius.control + 2,
      backgroundColor: theme.surface,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    hintText: { ...type.secondary, fontSize: 12, flex: 1, color: theme.textSecondary },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, marginTop: space.sm + 2 },
    chip: {
      justifyContent: 'center',
      height: HIT - 14,
      paddingHorizontal: space.sm + 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      maxWidth: 150,
    },
    chipText: { ...type.secondary, fontSize: 12, color: theme.textSecondary },
    chipTextActive: { color: theme.isDark ? '#06201A' : '#FFFFFF', fontFamily: font.bodySemiBold },

    scopeLine: { ...type.secondary, fontSize: 11, color: theme.textSecondary, marginTop: space.md - 2, marginBottom: space.xs },

    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingTop: space.md - 4,
      paddingBottom: space.xs + 2,
      paddingHorizontal: 2,
    },
    dayHeaderText: { ...type.label, color: theme.textSecondary },
    dayHeaderTotal: { ...type.amountSmall, fontSize: 12, color: theme.textSecondary },

    dayCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.card,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm + 2,
      borderLeftWidth: 4,
      minHeight: HIT,
      paddingVertical: space.sm + 2,
      paddingHorizontal: space.md - 4,
    },
    rowDivided: { borderTopWidth: 1, borderTopColor: theme.background },
    rowTitle: { ...type.bodyStrong, color: theme.text },
    rowSubtitle: { ...type.secondary, fontSize: 11, color: theme.textSecondary, marginTop: 1 },
    rowAmount: { ...type.amountSmall, color: theme.text },

    emptyText: { ...type.secondary, color: theme.textSecondary, paddingVertical: space.md - 2, textAlign: 'center' },
    moreButton: { alignItems: 'center', justifyContent: 'center', height: HIT, marginTop: space.xs },
    moreButtonText: { ...type.section, fontSize: 14, color: theme.primary },
  });
}
