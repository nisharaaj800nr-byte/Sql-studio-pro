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
import { StatCard } from '@/components/StatCard';
import { DatabaseCard } from '@/components/DatabaseCard';
import { QueryHistoryItem } from '@/components/QueryHistoryItem';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatNumber } from '@/utils/formatters';
import * as Haptics from 'expo-haptics';

const QUICK_TEMPLATES = [
  { label: 'List Tables', icon: 'table-multiple' as const, sql: "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;" },
  { label: 'Table Count', icon: 'counter' as const, sql: "SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type='table';" },
  { label: 'DB Stats', icon: 'database-cog' as const, sql: 'PRAGMA database_list;\nPRAGMA page_count;\nPRAGMA page_size;' },
  { label: 'Schema', icon: 'code-braces' as const, sql: "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name;" },
];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, isLoading, setActiveDbId } = useDatabases();
  const { queryHistory, setCurrentSql, totalQueriesRun } = useEditor();
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

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.appName, { color: colors.foreground }]}>SQL Studio Pro</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Mobile database IDE
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/ai')}
          style={[styles.aiBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
        >
          <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="database" label="Databases" value={databases.length} color={colors.primary} />
        <StatCard icon="table-multiple" label="Tables" value={totalTables} color={colors.accent} />
        <StatCard icon="history" label="Queries" value={formatNumber(queryHistory.length)} color="#D2A8FF" />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <Pressable
            onPress={() => router.push('/(tabs)/databases')}
            style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.primary + (pressed ? '30' : '18'), borderColor: colors.primary + '35' }]}
          >
            <MaterialCommunityIcons name="database-plus" size={24} color={colors.primary} />
            <Text style={[styles.quickLabel, { color: colors.primary }]}>New DB</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/editor')}
            style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.accent + (pressed ? '30' : '18'), borderColor: colors.accent + '35' }]}
          >
            <MaterialCommunityIcons name="play-circle-outline" size={24} color={colors.accent} />
            <Text style={[styles.quickLabel, { color: colors.accent }]}>Run SQL</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/history')}
            style={({ pressed }) => [styles.quickBtn, { backgroundColor: '#D2A8FF' + (pressed ? '30' : '18'), borderColor: '#D2A8FF35' }]}
          >
            <MaterialIcons name="history" size={24} color="#D2A8FF" />
            <Text style={[styles.quickLabel, { color: '#D2A8FF' }]}>History</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/ai')}
            style={({ pressed }) => [styles.quickBtn, { backgroundColor: '#FFA657' + (pressed ? '30' : '18'), borderColor: '#FFA65735' }]}
          >
            <MaterialCommunityIcons name="robot-outline" size={24} color="#FFA657" />
            <Text style={[styles.quickLabel, { color: '#FFA657' }]}>AI Help</Text>
          </Pressable>
        </View>
      </View>

      {/* SQL Templates */}
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
              <View style={[styles.templateIcon, { backgroundColor: colors.primary + '20' }]}>
                <MaterialCommunityIcons name={t.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.templateLabel, { color: colors.foreground }]}>{t.label}</Text>
              <MaterialIcons name="north-east" size={13} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Recent Databases */}
      {recentDBs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Databases</Text>
            <Pressable onPress={() => router.push('/(tabs)/databases')}>
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

      {/* Recent Queries */}
      {recentHistory.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Queries</Text>
            <Pressable onPress={() => router.push('/(tabs)/history')}>
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

      {/* Empty state */}
      {databases.length === 0 && !isLoading && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '20' }]}>
            <MaterialCommunityIcons name="database-plus" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Get Started</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Create your first SQLite database to start running queries.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/databases')}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="database-plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Create Database</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerText: { gap: 2 },
  appName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },
  aiBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seeAll: { fontSize: 13, fontWeight: '600' },

  // Quick actions grid
  quickGrid: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  quickLabel: { fontSize: 11, fontWeight: '700' },

  // Card / template list
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  templateIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Empty state
  emptyCard: {
    padding: 28,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },
});
