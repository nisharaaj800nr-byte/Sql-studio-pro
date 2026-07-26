import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useEditor } from '@/contexts/EditorContext';
import { QueryHistoryItem } from '@/components/QueryHistoryItem';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { formatTimestamp } from '@/utils/formatters';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 64;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'success' | 'failed';

function formatGroupDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  });
}

// ─── Glow-pulse animated clock illustration ───────────────────────────────────

function GlowClockIllustration() {
  const pulse = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Outer ring pulse — useNativeDriver:false for web/opacity+scale compat
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Slow rotation — useNativeDriver:false for web compat
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const outerScale  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] });
  const midOpacity  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });

  const spinDeg = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Scatter dots — fixed positions around the rings
  const DOTS = [
    { cx: 14,  cy: 52,  r: 2,   opacity: 0.6 },
    { cx: 168, cy: 38,  r: 1.5, opacity: 0.5 },
    { cx: 22,  cy: 120, r: 1.5, opacity: 0.4 },
    { cx: 160, cy: 130, r: 2,   opacity: 0.55 },
    { cx: 78,  cy: 8,   r: 1.5, opacity: 0.4 },
    { cx: 110, cy: 175, r: 1.5, opacity: 0.45 },
    { cx: 6,   cy: 82,  r: 1.2, opacity: 0.35 },
    { cx: 176, cy: 90,  r: 1.2, opacity: 0.35 },
    { cx: 140, cy: 20,  r: 1,   opacity: 0.3 },
    { cx: 50,  cy: 166, r: 1,   opacity: 0.3 },
  ];

  return (
    <View style={illus.container}>
      {/* SVG base: outer rings + dots */}
      <Svg width={182} height={182} viewBox="0 0 182 182" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#4B7BFF" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#4B7BFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient glow fill */}
        <Circle cx={91} cy={91} r={82} fill="url(#centerGlow)" />

        {/* Scatter dots */}
        {DOTS.map((d, i) => (
          <Circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill="#6C8EFF"
            fillOpacity={d.opacity}
          />
        ))}
      </Svg>

      {/* Animated outer dashed ring */}
      <Animated.View
        style={[
          illus.outerRing,
          { opacity: outerOpacity, transform: [{ scale: outerScale }] },
        ]}
      >
        <Svg width={182} height={182} viewBox="0 0 182 182">
          <Circle
            cx={91}
            cy={91}
            r={86}
            stroke="#4B7BFF"
            strokeWidth={1}
            strokeDasharray="4 7"
            strokeOpacity={0.55}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Animated mid ring */}
      <Animated.View style={[illus.midRing, { opacity: midOpacity }]}>
        <Svg width={140} height={140} viewBox="0 0 140 140">
          <Circle
            cx={70}
            cy={70}
            r={66}
            stroke="#3D5ECC"
            strokeWidth={1.5}
            strokeDasharray="3 5"
            strokeOpacity={0.6}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Inner dark circle with blue border */}
      <View style={illus.innerCircle}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          {/* Dark fill circle */}
          <Circle cx={48} cy={48} r={47} fill="#07101E" />
          {/* Blue stroke border */}
          <Circle
            cx={48}
            cy={48}
            r={44}
            stroke="#4B7BFF"
            strokeWidth={2}
            strokeOpacity={0.9}
            fill="none"
          />

          {/* Clock face — outer circle */}
          <Circle
            cx={48}
            cy={48}
            r={28}
            stroke="#4B7BFF"
            strokeWidth={1.5}
            strokeOpacity={0.5}
            fill="none"
          />

          {/* Clock tick marks at 12, 3, 6, 9 */}
          <Line x1="48" y1="22" x2="48" y2="26" stroke="#4B7BFF" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.7} />
          <Line x1="74" y1="48" x2="70" y2="48" stroke="#4B7BFF" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.7} />
          <Line x1="48" y1="74" x2="48" y2="70" stroke="#4B7BFF" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.7} />
          <Line x1="22" y1="48" x2="26" y2="48" stroke="#4B7BFF" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.7} />

          {/* Hour hand (pointing ~10 o'clock) */}
          <Line
            x1="48"
            y1="48"
            x2="34"
            y2="36"
            stroke="#6C9FFF"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeOpacity={0.95}
          />

          {/* Minute hand (pointing ~2 o'clock) */}
          <Line
            x1="48"
            y1="48"
            x2="58"
            y2="28"
            stroke="#4B7BFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeOpacity={0.95}
          />

          {/* Center dot */}
          <Circle cx={48} cy={48} r={3} fill="#6C9FFF" />
        </Svg>
      </View>
    </View>
  );
}

const illus = StyleSheet.create({
  container: {
    width: 182,
    height: 182,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  outerRing: {
    position: 'absolute',
    width: 182,
    height: 182,
    alignItems: 'center',
    justifyContent: 'center',
  },
  midRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    // Blue glow shadow
    shadowColor: '#4B7BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 12,
  },
});

// ─── Premium Empty State ──────────────────────────────────────────────────────

function PremiumEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={empty.container}>
      <GlowClockIllustration />
      <Text style={empty.title}>{title}</Text>
      <Text style={empty.description}>{description}</Text>
    </View>
  );
}

const empty = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { queryHistory, deleteHistoryEntry, clearHistory, setCurrentSql } = useEditor();

  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<FilterMode>('all');
  const [showFilter, setShowFilter] = useState(false);

  // Derived counts
  const successCount = queryHistory.filter(q => q.success).length;
  const failCount    = queryHistory.filter(q => !q.success).length;

  const filtered = useMemo(() => {
    let result = queryHistory;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        q =>
          q.sql.toLowerCase().includes(lower) ||
          q.databaseName.toLowerCase().includes(lower)
      );
    }
    if (filter === 'success') result = result.filter(q => q.success);
    if (filter === 'failed')  result = result.filter(q => !q.success);
    return result;
  }, [queryHistory, search, filter]);

  const sections = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const entry of filtered) {
      const key = formatGroupDate(entry.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const handleUse = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/editor');
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClear = () => {
    Alert.alert('Clear History', 'Delete all query history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => {
          clearHistory();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const toggleFilter = () => {
    setShowFilter(v => !v);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const FILTERS: { key: FilterMode; label: string; count: number }[] = [
    { key: 'all',     label: 'All',     count: queryHistory.length },
    { key: 'success', label: 'Success', count: successCount },
    { key: 'failed',  label: 'Failed',  count: failCount },
  ];

  const emptyTitle = search || filter !== 'all' ? 'No matches' : 'No query history';
  const emptyDesc  = search
    ? `No queries match "${search}"`
    : filter !== 'all'
    ? `No ${filter} queries found`
    : 'Executed queries will appear here.';

  return (
    <View style={[s.root, { backgroundColor: '#090D14' }]}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.headerTitle}>History</Text>

        <View style={s.headerActions}>
          {queryHistory.length > 0 && (
            <Pressable onPress={handleClear} hitSlop={8} style={s.clearBtn}>
              <Ionicons name="trash-outline" size={16} color="#F85149" />
            </Pressable>
          )}
          <Pressable
            onPress={toggleFilter}
            hitSlop={8}
            style={[s.filterBtn, showFilter && s.filterBtnActive]}
          >
            <Ionicons
              name="funnel"
              size={17}
              color={showFilter ? '#FFFFFF' : '#7B9FFF'}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color="#4A5568" style={s.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search queries or database..."
            placeholderTextColor="#3D4A5C"
            style={s.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8} style={s.clearInput}>
              <Ionicons name="close-circle" size={17} color="#3D4A5C" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filter pills (shown when filter button tapped, or when history exists) ── */}
      {(showFilter || filter !== 'all') && queryHistory.length > 0 && (
        <View style={s.filterBar}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  setFilter(f.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  s.filterPill,
                  active && s.filterPillActive,
                ]}
              >
                {active && <View style={s.filterDot} />}
                <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                  {f.label}
                </Text>
                {f.count > 0 && (
                  <Text style={[s.filterPillCount, active && s.filterPillCountActive]}>
                    {f.count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── List or empty state ── */}
      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={q => q.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <QueryHistoryItem
              entry={item}
              onPress={() => handleUse(item.sql)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={{
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16,
            paddingTop: 4,
          }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
        />
      ) : (
        <PremiumEmptyState title={emptyTitle} description={emptyDesc} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(248,81,73,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.2)',
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(75,123,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(75,123,255,0.25)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(75,123,255,0.35)',
    borderColor: 'rgba(75,123,255,0.6)',
  },

  // Search bar
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1520',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1C2438',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#8899BB',
    letterSpacing: 0.1,
  },
  clearInput: {
    padding: 2,
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0D1520',
    borderWidth: 1,
    borderColor: '#1C2438',
  },
  filterPillActive: {
    backgroundColor: 'rgba(75,123,255,0.15)',
    borderColor: 'rgba(75,123,255,0.45)',
  },
  filterDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4B7BFF',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4A5568',
  },
  filterPillTextActive: {
    color: '#7B9FFF',
    fontWeight: '700',
  },
  filterPillCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3D4A5C',
  },
  filterPillCountActive: {
    color: '#7B9FFF',
  },

  // Section headers
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: '#090D14',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#3D4A5C',
  },
});
