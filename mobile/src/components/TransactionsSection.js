import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getPersonColor } from '../utils/personColor';
import { matches } from '../utils/search';
import { formatDayHeader } from '../i18n/dateFormat';
import Money from './AmountText';

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
  const { t, language } = useSettings();
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
            {group.items.map((row) => (
              <TouchableOpacity
                key={`${row.type}-${row.id}`}
                style={[styles.row, { borderLeftColor: getPersonColor(row.owner) }]}
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
    wrap: { marginTop: 28 },
    sectionBreak: {
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: -16,
      marginBottom: 22,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 999,
      padding: 3,
      marginBottom: 10,
    },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
    segmentText: { fontSize: 13, color: theme.textSecondary },
    segmentTextActive: { color: '#fff', fontWeight: '700' },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 42,
    },
    searchInput: { flex: 1, fontSize: 14, color: theme.text, padding: 0 },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
      marginTop: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    hintText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.textSecondary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      maxWidth: 150,
    },
    chipText: { fontSize: 12, color: theme.textSecondary },
    chipTextActive: { color: '#fff', fontWeight: '700' },
    scopeLine: { fontSize: 11, color: theme.textSecondary, marginTop: 14, marginBottom: 4 },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingTop: 12,
      paddingBottom: 5,
      paddingHorizontal: 2,
    },
    dayHeaderText: { fontSize: 11, color: theme.textSecondary },
    dayHeaderTotal: { fontSize: 11, color: theme.textSecondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderLeftWidth: 4,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 6,
    },
    rowTitle: { fontSize: 14, color: theme.text },
    rowSubtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
    rowAmount: { fontSize: 14, fontWeight: '700' },
    emptyText: { fontSize: 13, color: theme.textSecondary, paddingVertical: 14, textAlign: 'center' },
    moreButton: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    moreButtonText: { fontSize: 13, color: theme.primary, fontWeight: '700' },
  });
}
