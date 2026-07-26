import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { useColors } from '@/hooks/useColors';
import { formatNumber } from '@/utils/formatters';
import { InputModal } from '@/components/InputModal';
import { pickAndImportDatabase, copyImportedDb } from '@/utils/exportUtils';

// ── Premium design tokens ───────────────────────────────────────────────────
const P = {
  bg:         '#070B12',
  card:       '#111827',
  cardBorder: 'rgba(255,255,255,0.07)',
  primary:    '#4F8DFF',
  accent:     '#7C5CFF',
  success:    '#22C55E',
  warning:    '#F59E0B',
  error:      '#EF4444',
  text:       '#F1F5F9',
  textDim:    '#94A3B8',
  textMuted:  '#64748B',
};

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 78 : 64;
const { width: SW } = Dimensions.get('window');

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ── Static data ─────────────────────────────────────────────────────────────
type QuickActionKey = 'new-db' | 'run-sql' | 'history' | 'import-db' | 'db-explorer' | 'ai-help';

const QUICK_ACTIONS: { key: QuickActionKey; label: string; sub: string; icon: any; bg: [string, string] }[] = [
  {
    key: 'new-db',
    label: 'New Database', sub: 'Create new DB',
    icon: 'server',
    bg: ['#1E3A8A', '#3B82F6'],
  },
  {
    key: 'run-sql',
    label: 'Run SQL', sub: 'Execute query',
    icon: 'play',
    bg: ['#14532D', '#22C55E'],
  },
  {
    key: 'history',
    label: 'History', sub: 'Query history',
    icon: 'time',
    bg: ['#3B0764', '#7C5CFF'],
  },
  {
    key: 'import-db',
    label: 'Import DB', sub: 'From file',
    icon: 'download-outline',
    bg: ['#78350F', '#F59E0B'],
  },
  {
    key: 'db-explorer',
    label: 'DB Explorer', sub: 'Browse data',
    icon: 'layers-outline',
    bg: ['#164E63', '#06B6D4'],
  },
  {
    key: 'ai-help',
    label: 'AI Help', sub: 'Ask AI assistant',
    icon: 'sparkles',
    bg: ['#831843', '#EC4899'],
  },
];

const SQL_TEMPLATES = [
  {
    label: 'List Tables',
    sub: 'Browse every table',
    icon: 'grid-outline' as const,
    color: '#4F8DFF',
    sql: "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;",
  },
  {
    label: 'Table Count',
    sub: 'Count records in a table',
    icon: 'calculator-outline' as const,
    color: '#22C55E',
    sql: "SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type='table';",
  },
  {
    label: 'Database Stats',
    sub: 'Database statistics overview',
    icon: 'stats-chart-outline' as const,
    color: '#7C5CFF',
    sql: 'PRAGMA database_list;\nPRAGMA page_count;\nPRAGMA page_size;',
  },
  {
    label: 'Schema Info',
    sub: 'View database schema details',
    icon: 'code-slash-outline' as const,
    color: '#F59E0B',
    sql: "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name;",
  },
];

// ── Main screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const isDark  = colors.isDark;
  const { databases, isLoading, setActiveDbId, activeDbId, createDatabase } = useDatabases();
  const { queryHistory, totalQueriesRun, savedQueries, setCurrentSql } = useEditor();
  const [totalTables, setTotalTables] = React.useState(0);

  // ── Search state ──
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Import state ──
  const [importing,       setImporting]       = useState(false);
  const [pendingImport,   setPendingImport]   = useState<{ uri: string; suggestedName: string } | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  // ── Animations ──
  const heroAnim    = useRef(new Animated.Value(0)).current;
  const statsAnim   = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const bottomAnim  = useRef(new Animated.Value(0)).current;
  const fabPulse    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(heroAnim,    { toValue: 1, tension: 80, friction: 8, useNativeDriver: false }),
      Animated.spring(statsAnim,   { toValue: 1, tension: 80, friction: 8, useNativeDriver: false }),
      Animated.spring(actionsAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: false }),
      Animated.spring(bottomAnim,  { toValue: 1, tension: 80, friction: 8, useNativeDriver: false }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1.1, duration: 1600, useNativeDriver: false }),
        Animated.timing(fabPulse, { toValue: 1.0, duration: 1600, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (databases.length === 0) { setTotalTables(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getTables } = await import('@/utils/sqliteManager');
        let count = 0;
        for (const db of databases) {
          const items = await getTables(db.id);
          count += items.filter((t: any) => t.type === 'table').length;
        }
        if (!cancelled) setTotalTables(count);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [databases]);

  const handleTemplate = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/editor');
  };

  // ── Import DB flow ────────────────────────────────────────────────────────
  const handleImportDB = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setImporting(true);
    try {
      const result = await pickAndImportDatabase();
      if (!result.success) { setImporting(false); return; }
      const raw = result.filename ?? 'imported';
      const suggested = raw.replace(/\.(db|sqlite3?|s3db)$/i, '').replace(/[_-]/g, ' ');
      setPendingImport({ uri: result.uri!, suggestedName: suggested });
      setImportModalVisible(true);
    } catch (e) {
      Alert.alert('Import Failed', (e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = async (name: string) => {
    setImportModalVisible(false);
    if (!pendingImport) return;
    try {
      const db = await createDatabase(name);
      await copyImportedDb(pendingImport.uri, db.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Imported!', `"${name}" imported successfully.`, [
        { text: 'Open', onPress: () => router.push(`/database/${db.id}`) },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert('Import Failed', (e as Error).message);
    } finally {
      setPendingImport(null);
    }
  };

  // ── Quick action dispatcher ───────────────────────────────────────────────
  const handleQuickAction = (key: QuickActionKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (key) {
      case 'new-db':
        router.push('/(tabs)/databases');
        break;
      case 'run-sql':
        router.push('/(tabs)/editor');
        break;
      case 'history':
        router.push('/(tabs)/history');
        break;
      case 'import-db':
        handleImportDB();
        break;
      case 'db-explorer':
        if (databases.length > 0) {
          const target = databases.find(d => d.id === activeDbId) ?? databases[0];
          setActiveDbId(target.id);
          router.push(`/database/${target.id}`);
        } else {
          router.push('/(tabs)/databases');
        }
        break;
      case 'ai-help':
        router.push('/ai');
        break;
    }
  };

  // ── Search filtering for recent DBs ──────────────────────────────────────
  const filteredDBs = searchQuery.trim()
    ? databases.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : databases;

  const recentDBs = (showSearch && searchQuery.trim() ? filteredDBs : databases).slice(0, 3);

  // Interpolations
  const heroY    = heroAnim.interpolate({ inputRange: [0,1], outputRange: [24, 0] });
  const statsY   = statsAnim.interpolate({ inputRange: [0,1], outputRange: [28, 0] });
  const actionsY = actionsAnim.interpolate({ inputRange: [0,1], outputRange: [32, 0] });
  const bottomY  = bottomAnim.interpolate({ inputRange: [0,1], outputRange: [36, 0] });

  const bg = isDark ? P.bg : colors.background;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings'); }}
              style={[s.menuBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : colors.card }]}
              hitSlop={8}
            >
              <Ionicons name="menu-outline" size={20} color={isDark ? P.text : colors.foreground} />
            </Pressable>
            <View>
              <Text style={[s.greeting, { color: isDark ? P.textDim : colors.mutedForeground }]}>
                {getGreeting()} 👋
              </Text>
              <View style={s.titleRow}>
                <Text style={[s.titleAccent, { color: isDark ? P.primary : colors.primary }]}>SQL </Text>
                <Text style={[s.titleMain,   { color: isDark ? P.text    : colors.foreground }]}>Studio Pro</Text>
              </View>
              <Text style={[s.titleSub, { color: isDark ? P.textMuted : colors.mutedForeground }]}>
                Local SQLite IDE
              </Text>
            </View>
          </View>

          <View style={s.headerRight}>
            {/* Glass AI button */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/ai'); }}
              style={s.aiPill}
            >
              <LinearGradient
                colors={['#6D28D9', '#4F8DFF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.aiPillGrad}
              >
                <Ionicons name="sparkles" size={12} color="#FFF" />
                <Text style={s.aiPillText}>AI Assistant</Text>
              </LinearGradient>
            </Pressable>

            {/* Search */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
              style={[s.iconBtn, { backgroundColor: showSearch ? (isDark ? P.primary + '33' : colors.primarySubtle) : (isDark ? 'rgba(255,255,255,0.07)' : colors.card) }]}
              hitSlop={8}
            >
              <Ionicons name={showSearch ? 'close' : 'search-outline'} size={17} color={showSearch ? P.primary : (isDark ? P.text : colors.foreground)} />
            </Pressable>

            {/* Avatar */}
            <LinearGradient colors={['#6D28D9', '#4F8DFF']} style={s.avatar}>
              <Text style={s.avatarTxt}>S</Text>
            </LinearGradient>
          </View>
        </View>

        {/* ── SEARCH BAR ─────────────────────────────────────────── */}
        {showSearch && (
          <Animated.View style={{ opacity: heroAnim, marginBottom: 14 }}>
            <View style={[s.searchBar, { backgroundColor: isDark ? P.card : colors.card, borderColor: isDark ? P.cardBorder : colors.border }]}>
              <Ionicons name="search-outline" size={16} color={isDark ? P.textMuted : colors.mutedForeground} />
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search databases..."
                placeholderTextColor={isDark ? P.textMuted : colors.mutedForeground}
                style={[s.searchInput, { color: isDark ? P.text : colors.foreground }]}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={16} color={isDark ? P.textMuted : colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── HERO CARD ──────────────────────────────────────────── */}
        <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroY }], marginBottom: 14 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/databases')}
            style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
          >
            <LinearGradient
              colors={['#0F2060', '#1A3A9A', '#0D47A1']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.heroCard}
            >
              {/* Glow orbs */}
              <View style={s.heroGlow1} />
              <View style={s.heroGlow2} />

              <View style={s.heroInner}>
                {/* Left content */}
                <View style={s.heroLeft}>
                  <Text style={s.heroLabel}>ACTIVE DATABASES</Text>
                  <Text style={s.heroCount}>{databases.length}</Text>
                  <Text style={s.heroSub}>
                    {databases.length === 0
                      ? 'No database created yet'
                      : `${databases.length} database${databases.length !== 1 ? 's' : ''} ready`}
                  </Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(tabs)/databases');
                    }}
                    style={({ pressed }) => [s.heroBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                  >
                    <LinearGradient
                      colors={['#7C5CFF', '#4F8DFF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.heroBtnGrad}
                    >
                      <Ionicons name="add" size={14} color="#FFF" />
                      <Text style={s.heroBtnText}>Create New Database</Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                {/* DB icon illustration */}
                <View style={s.heroRight}>
                  <View style={s.dbRing}>
                    <View style={s.dbOrb}>
                      <Ionicons name="server" size={38} color="#A5B4FC" />
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ── STATS ROW ──────────────────────────────────────────── */}
        <Animated.View style={[s.statsRow, { opacity: statsAnim, transform: [{ translateY: statsY }] }]}>
          {([
            { label: 'Databases', value: databases.length, sub: 'Active',    icon: 'server-outline',   color: P.primary,  glow: '#4F8DFF' },
            { label: 'Tables',    value: totalTables,      sub: 'Total',     icon: 'grid-outline',     color: P.success,  glow: '#22C55E' },
            { label: 'Queries',   value: formatNumber(totalQueriesRun), sub: 'Executed', icon: 'flash-outline', color: P.accent, glow: '#7C5CFF' },
            { label: 'Saved',     value: savedQueries.length, sub: 'Queries', icon: 'bookmark-outline', color: P.warning, glow: '#F59E0B' },
          ] as const).map((st) => (
            <View
              key={st.label}
              style={[s.statCard, { backgroundColor: isDark ? P.card : colors.card, borderColor: isDark ? P.cardBorder : colors.border }]}
            >
              <View style={[s.statIconBox, { backgroundColor: st.glow + '22' }]}>
                <Ionicons name={st.icon as any} size={13} color={st.color} />
              </View>
              <Text style={[s.statVal, { color: isDark ? P.text : colors.foreground }]}>{st.value}</Text>
              <Text style={[s.statSub, { color: st.color }]}>{st.sub}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── QUICK ACTIONS ───────────────────────────────────────── */}
        <Animated.View style={{ opacity: actionsAnim, transform: [{ translateY: actionsY }] }}>
          <SectionHeader
            title="Quick Actions"
            isDark={isDark}
            primaryColor={isDark ? P.primary : colors.primary}
            textColor={isDark ? P.text : colors.foreground}
            onSeeAll={() => router.push('/(tabs)/databases')}
          />
          <View style={s.actionsGrid}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => handleQuickAction(a.key)}
                disabled={importing && a.key === 'import-db'}
                style={({ pressed }) => [
                  s.actionCard,
                  {
                    backgroundColor: isDark ? P.card : colors.card,
                    borderColor: isDark ? P.cardBorder : colors.border,
                    opacity: (importing && a.key === 'import-db') ? 0.5 : pressed ? 0.82 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <LinearGradient colors={a.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.actionIcon}>
                  <Ionicons name={a.icon} size={20} color="#FFF" />
                </LinearGradient>
                <Text style={[s.actionLabel, { color: isDark ? P.text    : colors.foreground }]}>{a.label}</Text>
                <Text style={[s.actionSub,   { color: isDark ? P.textMuted : colors.mutedForeground }]}>{a.sub}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── RECENT DATABASES ────────────────────────────────────── */}
        <Animated.View style={{ opacity: bottomAnim, transform: [{ translateY: bottomY }] }}>
          <SectionHeader
            title="Recent Databases"
            isDark={isDark}
            primaryColor={isDark ? P.primary : colors.primary}
            textColor={isDark ? P.text : colors.foreground}
            onSeeAll={() => router.push('/(tabs)/databases')}
          />

          {recentDBs.length > 0 ? (
            <View style={[s.listCard, { backgroundColor: isDark ? P.card : colors.card, borderColor: isDark ? P.cardBorder : colors.border }]}>
              {recentDBs.map((db, i) => (
                <Pressable
                  key={db.id}
                  onPress={() => { setActiveDbId(db.id); router.push(`/database/${db.id}`); }}
                  style={({ pressed }) => [
                    s.listRow,
                    {
                      borderBottomWidth: i < recentDBs.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: isDark ? P.cardBorder : colors.border,
                      backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.04)' : colors.muted) : 'transparent',
                    },
                  ]}
                >
                  <LinearGradient colors={[db.color + '44', db.color + '22']} style={s.listIcon}>
                    <Ionicons name="server" size={16} color={db.color} />
                  </LinearGradient>
                  <View style={s.listMeta}>
                    <Text style={[s.listName, { color: isDark ? P.text : colors.foreground }]}>{db.name}</Text>
                    <Text style={[s.listSub,  { color: isDark ? P.textMuted : colors.mutedForeground }]}>
                      {formatRelativeTime(db.lastModified)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={isDark ? P.textMuted : colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[s.emptyCard, { backgroundColor: isDark ? P.card : colors.card, borderColor: isDark ? P.cardBorder : colors.border }]}>
              <View style={[s.emptyIconBox, { backgroundColor: isDark ? '#4F8DFF18' : colors.primarySubtle }]}>
                <Ionicons name="folder-open-outline" size={28} color={isDark ? P.primary : colors.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: isDark ? P.text    : colors.foreground }]}>No Recent Databases</Text>
              <Text style={[s.emptySub,  { color: isDark ? P.textMuted : colors.mutedForeground }]}>
                Create or open a database to get started
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── SQL TEMPLATES ────────────────────────────────────────── */}
        <Animated.View style={{ opacity: bottomAnim }}>
          <SectionHeader
            title="SQL Templates"
            isDark={isDark}
            primaryColor={isDark ? P.primary : colors.primary}
            textColor={isDark ? P.text : colors.foreground}
            onSeeAll={() => router.push('/(tabs)/editor')}
          />
          <View style={[s.listCard, { backgroundColor: isDark ? P.card : colors.card, borderColor: isDark ? P.cardBorder : colors.border }]}>
            {SQL_TEMPLATES.map((t, i) => (
              <Pressable
                key={t.label}
                onPress={() => handleTemplate(t.sql)}
                style={({ pressed }) => [
                  s.listRow,
                  {
                    borderBottomWidth: i < SQL_TEMPLATES.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: isDark ? P.cardBorder : colors.border,
                    backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.04)' : colors.muted) : 'transparent',
                  },
                ]}
              >
                <View style={[s.templateIcon, { backgroundColor: t.color + '18' }]}>
                  <Ionicons name={t.icon} size={16} color={t.color} />
                </View>
                <View style={s.listMeta}>
                  <Text style={[s.listName, { color: isDark ? P.text    : colors.foreground }]}>{t.label}</Text>
                  <Text style={[s.listSub,  { color: isDark ? P.textMuted : colors.mutedForeground }]}>{t.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={isDark ? P.textMuted : colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </Animated.View>

      </ScrollView>

      {/* ── FLOATING AI BUTTON ─────────────────────────────────────── */}
      <Animated.View
        style={[s.fabWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16, transform: [{ scale: fabPulse }], pointerEvents: 'box-none' } as any]}
      >
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/ai'); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}
        >
          <LinearGradient
            colors={['#7C5CFF', '#4F8DFF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.fab}
          >
            <Ionicons name="sparkles" size={22} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ── IMPORT MODAL ──────────────────────────────────────────── */}
      <InputModal
        visible={importModalVisible}
        title="Name this Database"
        message={`Importing: ${pendingImport?.suggestedName ?? 'database'}`}
        placeholder="Database name"
        defaultValue={pendingImport?.suggestedName ?? ''}
        confirmLabel="Import"
        onConfirm={handleImportConfirm}
        onCancel={() => { setImportModalVisible(false); setPendingImport(null); }}
      />
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function SectionHeader({
  title, onSeeAll, isDark, primaryColor, textColor,
}: {
  title: string; onSeeAll: () => void;
  isDark: boolean; primaryColor: string; textColor: string;
}) {
  return (
    <View style={s.sectionRow}>
      <Text style={[s.sectionTitle, { color: textColor }]}>{title}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8} style={s.seeAllBtn}>
        <Text style={[s.seeAll, { color: primaryColor }]}>View All</Text>
        <Ionicons name="chevron-forward" size={12} color={primaryColor} />
      </Pressable>
    </View>
  );
}

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const CARD_W = (SW - 32 - 20) / 3; // 3-column grid with 32 padding + 20 gaps

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 16 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 2 },

  menuBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6 },

  greeting:    { fontSize: 12, fontWeight: '500', marginBottom: 1 },
  titleRow:    { flexDirection: 'row', alignItems: 'baseline' },
  titleAccent: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  titleMain:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  titleSub:    { fontSize: 11, marginTop: 1 },

  aiPill:       { borderRadius: 99, overflow: 'hidden' },
  aiPillGrad:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99 },
  aiPillText:   { color: '#FFF', fontSize: 11, fontWeight: '700' },

  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatar:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  // Hero card
  heroCard:  { borderRadius: 24, overflow: 'hidden', minHeight: 168 },
  heroGlow1: { position: 'absolute', right: -20, top: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(124,92,255,0.28)' },
  heroGlow2: { position: 'absolute', right: 30, bottom: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(79,141,255,0.18)' },
  heroInner: { flexDirection: 'row', alignItems: 'center', padding: 24, paddingRight: 12 },
  heroLeft:  { flex: 1 },
  heroRight: { width: 96, alignItems: 'center' },

  heroLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(165,180,252,0.75)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  heroCount: { fontSize: 60, fontWeight: '900', color: '#FFF', letterSpacing: -3, lineHeight: 68, marginBottom: 2 },
  heroSub:   { fontSize: 12, color: 'rgba(199,210,254,0.8)', marginBottom: 18 },

  heroBtn:     { alignSelf: 'flex-start', borderRadius: 99, overflow: 'hidden' },
  heroBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  heroBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  dbRing: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(165,180,252,0.12)', alignItems: 'center', justifyContent: 'center' },
  dbOrb:  { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(79,141,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsRow:   { flexDirection: 'row', gap: 8, marginBottom: 22 },
  statCard:   { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, gap: 3 },
  statIconBox:{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statVal:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statSub:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Section header
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  seeAllBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll:       { fontSize: 13, fontWeight: '600' },

  // Search bar
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },

  // Quick actions 2×3 grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  actionCard:  { width: CARD_W, borderRadius: 18, borderWidth: 1, padding: 14, gap: 5 },
  actionIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionLabel: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  actionSub:   { fontSize: 10, lineHeight: 14 },

  // List card (recent dbs + templates share this)
  listCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  listRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  listIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listMeta: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  listSub:  { fontSize: 11 },

  templateIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Empty state
  emptyCard:    { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', gap: 8, marginBottom: 24 },
  emptyIconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 15, fontWeight: '700' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Floating AI button
  fabWrap: { position: 'absolute', right: 20 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 10,
    // boxShadow for web; shadow* for native
    ...Platform.select({
      web: { boxShadow: '0 6px 24px rgba(124,92,255,0.55)' },
      default: {
        shadowColor: '#7C5CFF', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55, shadowRadius: 14,
      },
    }),
  },
});
