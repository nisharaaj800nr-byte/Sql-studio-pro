import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { DatabaseCard } from '@/components/DatabaseCard';
import { QueryHistoryItem } from '@/components/QueryHistoryItem';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatNumber } from '@/utils/formatters';
import * as Haptics from 'expo-haptics';

const QUICK_TEMPLATES = [
  { label: 'List Tables', icon: 'grid-outline' as const, sql: "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;" },
  { label: 'Table Count', icon: 'calculator-outline' as const, sql: "SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type='table';" },
  { label: 'DB Stats', icon: 'stats-chart-outline' as const, sql: 'PRAGMA database_list;\nPRAGMA page_count;\nPRAGMA page_size;' },
  { label: 'Schema Info', icon: 'code-slash-outline' as const, sql: "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name;" },
];

const STAT_COLORS = ['#58A6FF', '#3FB950', '#D2A8FF'];
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 78 : 56;

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, isLoading, setActiveDbId } = useDatabases();
  const { queryHistory, setCurrentSql } = useEditor();
  const [totalTables, setTotalTables] = React.useState(0);

  React.useEffect(() => {
    if (databases.length === 0) { setTotalTables(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getTables } = await import('@/utils/sqliteManager');
        let count = 0;
        for (const db of databases) {
          const items = await getTables(db.id);
          count += items.filter(t => t.type === 'table').length;
        }
        if (!cancelled) setTotalTables(count);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [databases]);

  const recentDBs = databases.slice(0, 3);
  const recentHistory = queryHistory.slice(0, 5);

  const handleQuickTemplate = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/editor');
  };

  const stats = [
    { label: 'Databases', value: databases.length, icon: 'server-outline' as const, color: STAT_COLORS[0] },
    { label: 'Tables', value: totalTables, icon: 'grid-outline' as const, color: STAT_COLORS[1] },
    { label: 'Queries', value: formatNumber(queryHistory.length), icon: 'time-outline' as const, color: STAT_COLORS[2] },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 4,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Ionicons name="server" size={14} color="#fff" />
          </View>
          <View>
            <Text style={[styles.appName, { color: colors.foreground }]}>SQL Studio Pro</Text>
            <Text style={[styles.appSub, { color: colors.mutedForeground }]}>Local SQLite IDE</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/ai')}
          hitSlop={8}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
        </Pressable>
      </View>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {stats.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* ── Quick Actions ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'New DB',   icon: 'server'    as const, bg: '#1D4ED8', route: '/(tabs)/databases' as const },
            { label: 'Run SQL',  icon: 'play'      as const, bg: '#059669', route: '/(tabs)/editor'    as const },
            { label: 'History',  icon: 'time'      as const, bg: '#7C3AED', route: '/(tabs)/history'   as const },
            { label: 'AI Help',  icon: 'sparkles'  as const, bg: '#C2410C', route: '/ai'               as const },
          ].map(item => (
            <Pressable
              key={item.label}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route); }}
              style={({ pressed }) => [
                styles.quickBtn,
                { opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.quickLabel, { color: colors.foreground }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── SQL Templates ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>SQL Templates</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {QUICK_TEMPLATES.map((t, idx) => (
            <Pressable
              key={t.label}
              onPress={() => handleQuickTemplate(t.sql)}
              style={({ pressed }) => [
                styles.templateRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < QUICK_TEMPLATES.length - 1 ? StyleSheet.hairlineWidth : 0,
                  backgroundColor: pressed ? colors.muted : 'transparent',
                },
              ]}
            >
              <View style={[styles.templateIcon, { backgroundColor: colors.primary + '16' }]}>
                <Ionicons name={t.icon} size={14} color={colors.primary} />
              </View>
              <Text style={[styles.templateLabel, { color: colors.foreground }]}>{t.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Recent Databases ────────────────────────────────────────── */}
      {recentDBs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Databases</Text>
            <Pressable onPress={() => router.push('/(tabs)/databases')} hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {recentDBs.map(db => (
            <DatabaseCard
              key={db.id}
              database={db}
              onPress={() => {
                setActiveDbId(db.id);
                router.push(`/database/${db.id}`);
              }}
            />
          ))}
        </View>
      )}

      {/* ── Recent Queries ──────────────────────────────────────────── */}
      {recentHistory.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Queries</Text>
            <Pressable onPress={() => router.push('/(tabs)/history')} hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {recentHistory.map(entry => (
            <QueryHistoryItem
              key={entry.id}
              entry={entry}
              onPress={() => {
                setCurrentSql(entry.sql);
                setActiveDbId(entry.databaseId);
                router.push('/(tabs)/editor');
              }}
            />
          ))}
        </View>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {databases.length === 0 && !isLoading && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '16' }]}>
            <Ionicons name="server-outline" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Get Started</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Create your first SQLite database to start running queries locally on-device.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/databases')}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primaryForeground} />
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Create Database</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 15 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  appSub: { fontSize: 10, marginTop: 0.5, letterSpacing: 0.1 },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Stats card
  statsCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
    overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 10 },
  statValue: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },

  // Sections
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 7, letterSpacing: 0.1, textTransform: 'uppercase' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  seeAll: { fontSize: 13, fontWeight: '600' },

  // Quick actions grid
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 7,
  },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  quickLabel: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1 },

  // Card / template list
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 10,
  },
  templateIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Empty state
  emptyCard: {
    padding: 26,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 250 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 11,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700' },
});
