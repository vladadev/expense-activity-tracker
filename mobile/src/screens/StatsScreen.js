import React, { useMemo, useCallback, useRef, useState  } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Pressable, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { cachedGet } from '../api/cachedGet';
import { useSettings } from '../context/SettingsContext';
import { useHouseholds } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import StaleNotice from '../components/StaleNotice';
import LoadFailed from '../components/LoadFailed';
import DayBarChart from '../components/DayBarChart';
import CategoryBars from '../components/stats/CategoryBars';
import SplitBar from '../components/stats/SplitBar';
import PeriodHeadline from '../components/stats/PeriodHeadline';
import Money from '../components/AmountText';
import StatsSkeleton from '../components/StatsSkeleton';
import { useDeferredSkeleton } from '../components/Skeleton';
import { formatMonthYear } from '../i18n/dateFormat';
import { usePersonColor } from '../context/PersonColorsContext';
import { space, radius, type, HIT } from '../theme/scale';

const CATEGORY_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
const CURRENCY_ORDER = ['RSD', 'EUR', 'USD'];

const MONTHS_SHORT = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sr: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
};

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Format a LOCAL date as YYYY-MM-DD. toISOString() must not be used here —
// it converts to UTC, which for UTC+ timezones shifts the window a day back
// (e.g. "July" would become Jun 30 – Jul 30 and drop entries on Jul 31).
function localDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Every calendar day between two ISO dates, the empty ones included. The
// chart used to plot only days that HAD an entry, which made its x-axis look
// like time without being it.
function daysBetween(from, to) {
  const out = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    out.push(localDateString(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: localDateString(from), to: localDateString(to) };
}

function yearRange(offset = 0) {
  const year = new Date().getFullYear() + offset;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// Builds the same summary shape the server returns for a currency bucket,
// from a raw expense list — used so person-filtered views can be computed
// entirely on the client.
function computeSummary(list) {
  const s = {
    total: 0,
    personalTotal: 0,
    togetherTotal: 0,
    byCategory: {},
    byCategoryPersonal: {},
    byCategoryTogether: {},
    byOwner: {},
  };
  for (const e of list) {
    s.total += e.amount;
    if (e.type === 'personal') s.personalTotal += e.amount;
    else s.togetherTotal += e.amount;
    s.byCategory[e.category] = (s.byCategory[e.category] || 0) + e.amount;
    const typeCats = e.type === 'personal' ? s.byCategoryPersonal : s.byCategoryTogether;
    typeCats[e.category] = (typeCats[e.category] || 0) + e.amount;
    const name = e.owner?.name || '?';
    if (!s.byOwner[name]) s.byOwner[name] = { total: 0, personal: 0, together: 0 };
    s.byOwner[name].total += e.amount;
    s.byOwner[name][e.type] += e.amount;
  }
  return s;
}

// `embedded` means this screen is a face of Money rather than a destination of
// its own: it draws its body, and the title, the eye and the gear belong to the
// screen above it. See MoneyScreen.
export default function StatsScreen({ navigation, embedded = false }) {
  const { isSolo } = useHouseholds();
  const personColor = usePersonColor();
  const { t, language, formatAmount } = useSettings();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [dataType, setDataType] = useState('expenses'); // 'expenses' | 'income' | 'savings'
  const [periodMode, setPeriodMode] = useState('month'); // 'month' | 'year'
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [byDay, setByDay] = useState({});
  const [byCurrency, setByCurrency] = useState({});
  // Raw expenses from the range endpoint; null while the deployed backend
  // predates the field (person filtering is hidden in that case).
  const [expenses, setExpenses] = useState(null);
  // Income/savings entries when one of those data types is selected.
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  // First load only: a filter change already has a page to change, so redrawing
  // it as placeholders would be a step backwards.
  const [everLoaded, setEverLoaded] = useState(false);
  // Distinguishes "this really is empty" from "I could not find out".
  const [loadFailed, setLoadFailed] = useState(false);
  // Set when the screen is showing its last good copy instead of live data.
  const [staleAt, setStaleAt] = useState(null);
  // The same period one step back, by currency: the one comparison this screen
  // exists to make, and the one it never made.
  const [prevTotals, setPrevTotals] = useState({});
  // Which currency is shown in full. Null until the data says which one this
  // household actually spends in.
  const [currencyPick, setCurrencyPick] = useState(null);
  // The two breakdowns under the chart are the working, not the answer.
  // They open on a row you can see, which is the same bargain the calendar
  // struck with its month: hidden is fine as long as the handle is not.
  const [detailOpen, setDetailOpen] = useState(false);
  // typeFilter: 'all' | 'personal' | 'together'; personFilter: 'all' | owner name.
  const [typeFilter, setTypeFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const fade = useRef(new Animated.Value(1)).current;

  function animateContent() {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  function changeTypeFilter(next) {
    const value = typeFilter === next ? 'all' : next;
    if (value === typeFilter) return;
    setTypeFilter(value);
    animateContent();
  }

  function changePersonFilter(next) {
    if (next === personFilter) return;
    setPersonFilter(next);
    animateContent();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = periodMode === 'month' ? monthRange(monthOffset) : yearRange(yearOffset);
    try {
      if (dataType === 'expenses') {
        const res = await cachedGet(`/stats/range/${from}/${to}`);
        setByDay(res.data.byDay);
        setStaleAt(res.stale ? res.at : null);
        setByCurrency(res.data.byCurrency);
        setExpenses(res.data.expenses || null);
      } else if (dataType === 'income') {
        const res = await cachedGet('/income', { params: { from, to } });
        setEntries(res.data.entries);
      } else {
        const res = await cachedGet('/savings', { params: { from, to } });
        setEntries(res.data.entries);
      }
      setLoadFailed(false);
    } catch (err) {
      console.log('Failed to load stats:', err.message);
      setLoadFailed(true);
    }

    // The period before this one, for the comparison line, in a try of its
    // own: a headline without "12% less than last month" is still a headline,
    // and failing to reach last month must not blank out this one.
    try {
      const back = periodMode === 'month' ? monthRange(monthOffset - 1) : yearRange(yearOffset - 1);
      const totals = {};
      if (dataType === 'expenses') {
        const res = await cachedGet(`/stats/range/${back.from}/${back.to}`);
        for (const [cur, sum] of Object.entries(res.data.byCurrency || {})) totals[cur] = sum.total || 0;
      } else {
        const res = await cachedGet(dataType === 'income' ? '/income' : '/savings', {
          params: { from: back.from, to: back.to },
        });
        for (const e of res.data.entries || []) {
          const v = dataType === 'savings' && e.direction === 'withdrawal' ? -e.amount : e.amount;
          totals[e.currency] = (totals[e.currency] || 0) + v;
        }
      }
      setPrevTotals(totals);
    } catch (err) {
      console.log('No previous period to compare against:', err.message);
      setPrevTotals({});
    }

    setLoading(false);
    setEverLoaded(true);
  }, [dataType, periodMode, monthOffset, yearOffset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = new Date();
  const shownYear = now.getFullYear() + yearOffset;
  const shownMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentOffset = periodMode === 'month' ? monthOffset : yearOffset;
  const setCurrentOffset = periodMode === 'month' ? setMonthOffset : setYearOffset;
  const heading =
    periodMode === 'month' ? formatMonthYear(shownMonth, language) : language === 'sr' ? `${shownYear}.` : `${shownYear}`;

  const typeFilterLabel =
    typeFilter === 'personal'
      ? t('expenseStats.personal')
      : typeFilter === 'together'
        ? t('expenseStats.together')
        : t('expenseStats.total');

  // Distinct owners for the person chips (only when raw expenses are available).
  const persons = expenses ? [...new Set(expenses.map((e) => e.owner?.name).filter(Boolean))].sort() : [];
  const personExpenses =
    expenses && personFilter !== 'all' ? expenses.filter((e) => e.owner?.name === personFilter) : expenses;

  // Income/savings modes work off the raw entry lists.
  const entryPersons = [...new Set(entries.map((e) => e.owner?.name).filter(Boolean))].sort();
  const personEntries = personFilter === 'all' ? entries : entries.filter((e) => e.owner?.name === personFilter);
  const chipPersons = dataType === 'expenses' ? (expenses ? persons : []) : entryPersons;
  // Savings withdrawals count as negative so charts/totals show the net flow.
  const signedAmount = (e) => (dataType === 'savings' && e.direction === 'withdrawal' ? -e.amount : e.amount);
  const days = Object.keys(byDay).sort();

  // Who spent it, within one day. Sorted by name so the colours stack in the
  // same order every day and the eye can follow one band across the month.
  function segmentsOf(by) {
    return Object.entries(by)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value]) => ({ key: name, value, color: personColor(name) }));
  }

  // One bar per day of the period, or per month of the year — every one of
  // them, including the days nothing happened on. What it used to do was take
  // the last ten days that had an entry, so a month heading sat above a tenth
  // of the month and two neighbouring bars could be one day apart or nine.
  function barsFor({ list, currency }) {
    const dayKey = typeFilter === 'all' ? 'total' : typeFilter;

    if (periodMode === 'year') {
      const months = Array.from({ length: 12 }, () => ({ value: 0, by: {} }));
      if (list) {
        for (const e of list) {
          if (typeFilter !== 'all' && e.type !== typeFilter) continue;
          const m = parseInt(e.date.slice(5, 7), 10) - 1;
          const v = signedAmount(e);
          months[m].value += v;
          const name = e.owner?.name || '?';
          months[m].by[name] = (months[m].by[name] || 0) + v;
        }
      } else {
        for (const d of days) {
          months[parseInt(d.slice(5, 7), 10) - 1].value += byDay[d][currency]?.[dayKey] || 0;
        }
      }
      const labels = MONTHS_SHORT[language] || MONTHS_SHORT.en;
      return months.map((m, i) => ({ label: labels[i], date: i, value: m.value, segments: segmentsOf(m.by) }));
    }

    const { from, to } = monthRange(monthOffset);
    const all = daysBetween(from, to);
    const bucket = {};
    for (const d of all) bucket[d] = { value: 0, by: {} };

    if (list) {
      for (const e of list) {
        if (typeFilter !== 'all' && e.type !== typeFilter) continue;
        const d = e.date.slice(0, 10);
        if (!bucket[d]) continue;
        const v = signedAmount(e);
        bucket[d].value += v;
        const name = e.owner?.name || '?';
        bucket[d].by[name] = (bucket[d].by[name] || 0) + v;
      }
    } else {
      for (const d of all) bucket[d].value = byDay[d]?.[currency]?.[dayKey] || 0;
    }

    return all.map((d) => ({
      label: String(parseInt(d.slice(8, 10), 10)),
      date: d,
      value: bucket[d].value,
      segments: segmentsOf(bucket[d].by),
    }));
  }

  const groupedEntries = {};
  if (dataType !== 'expenses') {
    for (const e of personEntries) {
      if (!groupedEntries[e.currency]) groupedEntries[e.currency] = [];
      groupedEntries[e.currency].push(e);
    }
  }
  const entryCurrencies = Object.keys(groupedEntries).sort(
    (a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b)
  );

  // Currency sections: computed client-side when raw expenses exist, otherwise
  // straight from the server aggregates (old backend fallback).
  let currencySections;
  if (personExpenses) {
    const grouped = {};
    for (const e of personExpenses) {
      if (!grouped[e.currency]) grouped[e.currency] = [];
      grouped[e.currency].push(e);
    }
    currencySections = Object.keys(grouped)
      .sort((a, b) => CURRENCY_ORDER.indexOf(a) - CURRENCY_ORDER.indexOf(b))
      .map((currency) => ({ currency, summary: computeSummary(grouped[currency]), list: grouped[currency] }));
  } else {
    currencySections = Object.keys(byCurrency).map((currency) => ({
      currency,
      summary: byCurrency[currency],
      list: null,
    }));
  }

  // Income and savings carry the same shape as expenses from here on, so the
  // screen below is written once rather than twice.
  const entrySections = entryCurrencies.map((currency) => {
    const list = groupedEntries[currency];
    const summary = { total: 0, personalTotal: 0, togetherTotal: 0, byCategory: {}, byOwner: {} };
    for (const e of list) {
      const v = signedAmount(e);
      summary.total += v;
      if (dataType === 'savings') {
        if (e.type === 'personal') summary.personalTotal += v;
        else summary.togetherTotal += v;
      }
      const name = e.owner?.name || '?';
      if (!summary.byOwner[name]) summary.byOwner[name] = { total: 0, personal: 0, together: 0 };
      summary.byOwner[name].total += v;
      if (dataType === 'savings') summary.byOwner[name][e.type] += v;
    }
    return { currency, list, summary };
  });

  const sections = dataType === 'expenses' ? currencySections : entrySections;
  // The currency this household actually spends in leads; the rest wait behind
  // a pill. Repeating the whole screen once per currency was what made it
  // three screens long instead of one.
  const biggest = [...sections].sort((a, b) => b.summary.total - a.summary.total)[0];
  const active = sections.find((x) => x.currency === currencyPick) || biggest;

  const hasData =
    dataType === 'expenses'
      ? personExpenses
        ? personExpenses.length > 0
        : days.length > 0
      : personEntries.length > 0;

  function handleBarPress(date) {
    if (periodMode === 'month') {
      // A per-day detail screen only exists for expenses.
      if (dataType !== 'expenses') return;
      navigation.navigate('ExpenseStats', { date, person: personFilter !== 'all' ? personFilter : undefined });
      return;
    }
    // Year view: a bar is a month — drill into that month's view.
    const target = new Date(shownYear, date, 1);
    const offset = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    if (offset > 0) return;
    setMonthOffset(offset);
    setPeriodMode('month');
    animateContent();
  }

  const showSkeleton = useDeferredSkeleton(loading && !everLoaded);

  if (!everLoaded) {
    return (
      <Screen title={t('nav.stats')} showBack={false} showPrivacyToggle bare={embedded}>
        {showSkeleton ? <StatsSkeleton /> : <View />}
      </Screen>
    );
  }

  const prevLabel = t(periodMode === 'month' ? 'stats.vsPrevMonth' : 'stats.vsPrevYear');
  const chartWidth = Dimensions.get('window').width - 64;

  let headlineTotal = 0;
  let categories = [];
  let splitParts = [];
  let bars = [];
  let owners = [];

  if (active) {
    const { summary, list, currency } = active;

    headlineTotal =
      typeFilter === 'personal'
        ? summary.personalTotal
        : typeFilter === 'together'
          ? summary.togetherTotal
          : summary.total;

    if (dataType === 'expenses') {
      // Older backend responses have no per-type category split; fall back to
      // the unfiltered rollup until the API is redeployed.
      const typeCategories =
        typeFilter === 'personal'
          ? summary.byCategoryPersonal
          : typeFilter === 'together'
            ? summary.byCategoryTogether
            : null;
      const source = typeFilter !== 'all' && typeCategories ? typeCategories : summary.byCategory;
      categories = Object.entries(source)
        .sort((x, y) => y[1] - x[1])
        .map(([name, amount], i) => ({ name, amount, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
    }

    if (!isSolo && dataType !== 'income' && summary.personalTotal + summary.togetherTotal > 0) {
      splitParts = [
        { key: 'personal', name: t('expenseStats.personal'), amount: summary.personalTotal, color: theme.primary },
        { key: 'together', name: t('expenseStats.together'), amount: summary.togetherTotal, color: '#F59E0B' },
      ];
    }

    bars = barsFor({ list, currency });
    owners = Object.entries(summary.byOwner || {});
  }

  const hasBars = bars.some((d) => d.value > 0);
  const legend = chipPersons.map((name) => ({ key: name, name, color: personColor(name) }));

  return (
    <Screen title={t('nav.stats')} showBack={false} showPrivacyToggle bare={embedded}>
      <StaleNotice at={staleAt} />
      <ScrollView contentContainerStyle={{ padding: space.md }}>
        <View style={styles.segmentRow}>
          {[
            { key: 'expenses', label: t('finance.expenses') },
            { key: 'income', label: t('finance.incomeSection') },
            { key: 'savings', label: t('finance.savings') },
          ].map((seg) => (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, dataType === seg.key && { backgroundColor: theme.primary }]}
              onPress={() => {
                if (dataType !== seg.key) {
                  setDataType(seg.key);
                  setTypeFilter('all');
                  animateContent();
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, dataType === seg.key && styles.segmentTextActive]}>{seg.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.monthNavRow}>
          <TouchableOpacity
            onPress={() => setCurrentOffset((o) => o - 1)}
            style={styles.navButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthHeading}>{heading}</Text>
          <TouchableOpacity
            onPress={() => setCurrentOffset((o) => Math.min(o + 1, 0))}
            disabled={currentOffset >= 0}
            style={styles.navButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={24} color={currentOffset >= 0 ? theme.border : theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Period length and currency are both "how wide am I looking", so they
            share a row rather than taking one each. */}
        <View style={styles.scopeRow}>
          {[
            { key: 'month', label: t('stats.monthly') },
            { key: 'year', label: t('stats.yearly') },
          ].map((seg) => {
            const on = periodMode === seg.key;
            return (
              <Pressable
                key={seg.key}
                style={[styles.scopePill, on && styles.scopePillOn]}
                onPress={() => {
                  if (periodMode !== seg.key) {
                    setPeriodMode(seg.key);
                    animateContent();
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.scopePillText, on && styles.scopePillTextOn]}>{seg.label}</Text>
              </Pressable>
            );
          })}

          {sections.length > 1 && <View style={styles.scopeGap} />}
          {sections.length > 1 &&
            sections.map((sec) => {
              const on = active && sec.currency === active.currency;
              return (
                <Pressable
                  key={sec.currency}
                  style={[styles.scopePill, on && styles.scopePillOn]}
                  onPress={() => {
                    setCurrencyPick(sec.currency);
                    animateContent();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.scopePillText, on && styles.scopePillTextOn]}>{sec.currency}</Text>
                </Pressable>
              );
            })}
        </View>

        {/* More than one, not more than zero: a filter offering "everyone" and
            a single name is three taps that change nothing. */}
        {chipPersons.length > 1 && (
          <View style={styles.personRow}>
            <TouchableOpacity
              style={[
                styles.personChip,
                personFilter === 'all' && { borderColor: theme.primary, backgroundColor: hexToRgba(theme.primary, 0.12) },
              ]}
              onPress={() => changePersonFilter('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.personChipText, personFilter === 'all' && { color: theme.primary, fontWeight: '700' }]}>
                {t('stats.everyone')}
              </Text>
            </TouchableOpacity>
            {chipPersons.map((name) => {
              const color = personColor(name);
              const on = personFilter === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.personChip, on && { borderColor: color, backgroundColor: hexToRgba(color, 0.12) }]}
                  onPress={() => changePersonFilter(name)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.personChipDot, { backgroundColor: color }]} />
                  <Text style={[styles.personChipText, on && { color, fontWeight: '700' }]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {active && (
          <Animated.View style={{ opacity: fade }}>
            {/* The answer first. Everything under this is the working. */}
            <PeriodHeadline
              label={typeFilter === 'all' ? heading : `${heading} · ${typeFilterLabel}`}
              total={headlineTotal}
              prevTotal={typeFilter === 'all' ? prevTotals[active.currency] : null}
              prevLabel={prevLabel}
              currency={active.currency}
            />

            {dataType === 'expenses' && categories.length > 0 && (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>{t('stats.whereItWent')}</Text>
                <CategoryBars data={categories} total={headlineTotal} currency={active.currency} />
              </View>
            )}

            {!loading && hasBars && (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>{t('stats.byDay')}</Text>
                <View style={styles.chartCard}>
                  <DayBarChart
                    data={bars}
                    width={chartWidth}
                    theme={theme}
                    formatAmount={formatAmount}
                    currency={active.currency}
                    onBarPress={handleBarPress}
                    legend={personFilter === 'all' ? legend : null}
                  />
                </View>
              </View>
            )}

            {(splitParts.length === 2 || (personFilter === 'all' && owners.length > 1)) && (
              <Pressable
                onPress={() => setDetailOpen((v) => !v)}
                style={styles.detailToggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailOpen }}
              >
                <Text style={styles.detailToggleText}>{t('stats.moreDetail')}</Text>
                <Ionicons name={detailOpen ? 'chevron-up' : 'chevron-down'} size={17} color={theme.primary} />
              </Pressable>
            )}

            {detailOpen && splitParts.length === 2 && (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>{t('stats.personalVsTogether')}</Text>
                <SplitBar
                  parts={splitParts}
                  active={typeFilter === 'all' ? null : typeFilter}
                  onPick={changeTypeFilter}
                  currency={active.currency}
                />
              </View>
            )}

            {detailOpen && personFilter === 'all' && owners.length > 1 && (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>{t('stats.byPerson')}</Text>
                {owners.map(([name, breakdown]) => {
                  const color = personColor(name);
                  return (
                    <View key={name} style={[styles.ownerCard, { borderLeftColor: color }]}>
                      <View style={styles.ownerHeader}>
                        <View style={[styles.ownerDot, { backgroundColor: color }]} />
                        <Text style={styles.ownerName}>{name}</Text>
                        <Money value={breakdown.total} currency={active.currency} style={styles.ownerTotal} />
                      </View>
                      {!isSolo && dataType !== 'income' && typeFilter === 'all' && (
                        <View style={styles.ownerBreakdownRow}>
                          <View style={styles.ownerBreakdownCol}>
                            <Text style={styles.ownerBreakdownLabel}>{t('expenseStats.personal')}</Text>
                            <Money value={breakdown.personal} currency={active.currency} style={styles.ownerBreakdownValue} />
                          </View>
                          <View style={styles.ownerBreakdownDivider} />
                          <View style={styles.ownerBreakdownCol}>
                            <Text style={styles.ownerBreakdownLabel}>{t('stats.toTogether')}</Text>
                            <Money value={breakdown.together} currency={active.currency} style={styles.ownerBreakdownValue} />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {!loading && !hasData && (loadFailed ? <LoadFailed onRetry={load} /> : <Text style={styles.emptyText}>{t('stats.noneYet')}</Text>)}
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: radius.control + 4,
      padding: 4,
      marginBottom: space.sm + 4,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },
    segment: { flex: 1, height: 42, justifyContent: 'center', borderRadius: radius.control, alignItems: 'center' },
    segmentText: { ...type.bodyStrong, fontSize: 14, color: theme.textSecondary },
    segmentTextActive: { color: '#fff' },

    monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navButton: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    monthHeading: { ...type.title, fontSize: 19, color: theme.text },

    // How wide am I looking: period length and currency, one row between them.
    scopeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm - 2, marginBottom: space.md },
    scopeGap: { flex: 1 },
    scopePill: {
      minHeight: HIT - 10,
      justifyContent: 'center',
      paddingHorizontal: space.sm + 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    scopePillOn: { borderColor: theme.primary, backgroundColor: hexToRgba(theme.primary, 0.12) },
    scopePillText: { ...type.secondary, color: theme.textSecondary },
    scopePillTextOn: { color: theme.primary, fontWeight: '700' },

    personRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
    personChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm - 2,
      minHeight: HIT - 10,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    personChipDot: { width: 8, height: 8, borderRadius: 4 },
    personChipText: { ...type.secondary, color: theme.textSecondary },

    // A rule and a label, not a card: these are headings over the working, and
    // boxing each one turned the page into a stack of slabs.
    sectionWrap: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: theme.border },
    sectionTitle: { ...type.label, color: theme.textSecondary, marginBottom: space.sm + 4 },

    chartCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.card,
      padding: space.md,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },

    ownerCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.control,
      borderLeftWidth: 4,
      padding: space.sm + 4,
      marginBottom: space.sm + 2,
      borderTopWidth: theme.isDark ? 1 : 0,
      borderRightWidth: theme.isDark ? 1 : 0,
      borderBottomWidth: theme.isDark ? 1 : 0,
      borderColor: theme.border,
    },
    ownerHeader: { flexDirection: 'row', alignItems: 'center' },
    ownerDot: { width: 10, height: 10, borderRadius: 5, marginRight: space.sm },
    ownerName: { flex: 1, ...type.bodyStrong, color: theme.text },
    ownerTotal: { ...type.amountSmall, color: theme.text },
    ownerBreakdownRow: {
      flexDirection: 'row',
      marginTop: space.sm + 2,
      paddingTop: space.sm + 2,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    ownerBreakdownCol: { flex: 1, alignItems: 'center' },
    ownerBreakdownDivider: { width: 1, backgroundColor: theme.border, marginHorizontal: space.sm },
    ownerBreakdownLabel: { ...type.secondary, fontSize: 12, color: theme.textSecondary },
    ownerBreakdownValue: { ...type.amountSmall, fontSize: 14, color: theme.text, marginTop: 2 },

    detailToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs + 2,
      minHeight: HIT,
      marginTop: space.md,
      borderRadius: radius.control,
      backgroundColor: hexToRgba(theme.primary, 0.1),
    },
    detailToggleText: { ...type.bodyStrong, fontSize: 14, color: theme.primary },
    emptyText: { ...type.secondary, color: theme.textSecondary, textAlign: 'center', marginTop: space.lg },
  });
}
