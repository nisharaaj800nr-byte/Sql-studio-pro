import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  checkIntegrity,
  getForeignKeyCheck,
  getAllTableStats,
  getIndexes,
  getTables,
  dropIndex,
  TableStats,
  TableInfo,
} from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

type TabKey = 'integrity' | 'stats' | 'indexes';

export default function AnalyzerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('integrity');
  const [isLoading, setIsLoading] = useState(false);

  // Integrity state
  const [integrityResult, setIntegrityResult] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [fkResult, setFkResult] = useState<{ ok: boolean; issues: string[] } | null>(null);

  // Stats state
  const [tableStats, setTableStats] = useState<TableStats[]>([]);

  // Index state
  const [allItems, setAllItems] = useState<TableInfo[]>([]);
  const [indexMap, setIndexMap] = useState<Record<string, { name: string; unique: number }[]>>({});

  const runIntegrityCheck = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [ic, fk] = await Promise.all([checkIntegrity(id), getForeignKeyCheck(id)]);
      setIntegrityResult(ic);
      setFkResult(fk);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const loadStats = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const stats = await getAllTableStats(id);
      setTableStats(stats);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const loadIndexes = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const items = await getTables(id);
      const tables = items.filter(i => i.type === 'table');
      setAllItems(tables);
      const map: Record<string, { name: string; unique: number }[]> = {};
      await Promise.all(
        tables.map(async t => {
          const idxs = await getIndexes(id, t.name);
          if (idxs.length > 0) map[t.name] = idxs.map(i => ({ name: i.name, unique: i.unique }));
        })
      );
      setIndexMap(map);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'integrity') runIntegrityCheck();
    else if (activeTab === 'stats') loadStats();
    else if (activeTab === 'indexes') loadIndexes();
  }, [activeTab, runIntegrityCheck, loadStats, loadIndexes]);

  const handleDropIndex = (tableName: string, indexName: string) => {
    Alert.alert('Drop Index', `Drop index "${indexName}" from "${tableName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Drop',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const r = await dropIndex(id, indexName);
          if (r.error) {
            Alert.alert('Error', r.error);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            loadIndexes();
          }
        },
      },
    ]);
  };

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'integrity', label: 'Integrity', icon: 'verified' },
    { key: 'stats', label: 'Statistics', icon: 'bar-chart' },
    { key: 'indexes', label: 'Indexes', icon: 'speed' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Database Analyzer',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }}
      />

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              activeTab === tab.key && { borderBottomWidth: 2, borderBottomColor: colors.primary },
            ]}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Analyzing…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── INTEGRITY TAB ── */}
          {activeTab === 'integrity' && (
            <>
              {/* Re-run button */}
              <Pressable
                onPress={runIntegrityCheck}
                style={[styles.runBtn, { backgroundColor: colors.primary }]}
              >
                <MaterialIcons name="refresh" size={16} color="#fff" />
                <Text style={styles.runBtnText}>Run Integrity Check</Text>
              </Pressable>

              {/* Integrity Check */}
              <SectionCard title="SQLite Integrity Check" colors={colors}>
                {integrityResult ? (
                  <>
                    <StatusRow
                      ok={integrityResult.ok}
                      label={integrityResult.ok ? 'All pages and structures are intact' : `${integrityResult.issues.length} issue(s) found`}
                      colors={colors}
                    />
                    {integrityResult.issues.map((issue, i) => (
                      <Text key={i} style={[styles.issueText, { color: colors.destructive }]}>• {issue}</Text>
                    ))}
                  </>
                ) : (
                  <Text style={{ color: colors.mutedForeground }}>Tap "Run Integrity Check" to start.</Text>
                )}
              </SectionCard>

              {/* Foreign Key Check */}
              <SectionCard title="Foreign Key Check" colors={colors}>
                {fkResult ? (
                  <>
                    <StatusRow
                      ok={fkResult.ok}
                      label={fkResult.ok ? 'No foreign key violations' : `${fkResult.issues.length} violation(s) found`}
                      colors={colors}
                    />
                    {fkResult.issues.map((issue, i) => (
                      <Text key={i} style={[styles.issueText, { color: colors.destructive }]}>• {issue}</Text>
                    ))}
                  </>
                ) : (
                  <Text style={{ color: colors.mutedForeground }}>Results will appear above.</Text>
                )}
              </SectionCard>
            </>
          )}

          {/* ── STATS TAB ── */}
          {activeTab === 'stats' && (
            <>
              {tableStats.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <MaterialIcons name="bar-chart" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tables found</Text>
                </View>
              ) : (
                tableStats.map(stat => (
                  <View key={stat.name} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.statRow}>
                      <MaterialCommunityIcons name="table" size={18} color={colors.primary} />
                      <Text style={[styles.statName, { color: colors.foreground }]}>{stat.name}</Text>
                    </View>
                    <View style={styles.statMeta}>
                      <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                          {stat.rowCount.toLocaleString()} rows
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* ── INDEXES TAB ── */}
          {activeTab === 'indexes' && (
            <>
              {allItems.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <MaterialIcons name="speed" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tables found</Text>
                </View>
              ) : (
                allItems.map(table => {
                  const idxs = indexMap[table.name] ?? [];
                  return (
                    <View key={table.name} style={[styles.idxCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.idxTableHeader}>
                        <MaterialCommunityIcons name="table" size={16} color={colors.primary} />
                        <Text style={[styles.idxTableName, { color: colors.foreground }]}>{table.name}</Text>
                        <Text style={[styles.idxCount, { color: colors.mutedForeground }]}>{idxs.length} index{idxs.length !== 1 ? 'es' : ''}</Text>
                      </View>
                      {idxs.length === 0 ? (
                        <Text style={[styles.noIndex, { color: colors.mutedForeground }]}>No indexes on this table</Text>
                      ) : (
                        idxs.map(idx => (
                          <View key={idx.name} style={[styles.idxRow, { borderTopColor: colors.border }]}>
                            <MaterialIcons name="speed" size={14} color={colors.accent} />
                            <Text style={[styles.idxName, { color: colors.foreground }]}>{idx.name}</Text>
                            {idx.unique === 1 && (
                              <View style={[styles.uniqueBadge, { backgroundColor: `${colors.accent}20` }]}>
                                <Text style={[styles.uniqueText, { color: colors.accent }]}>UNIQUE</Text>
                              </View>
                            )}
                            <Pressable
                              onPress={() => handleDropIndex(table.name, idx.name)}
                              hitSlop={8}
                              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginLeft: 'auto' })}
                            >
                              <MaterialIcons name="delete-outline" size={18} color={colors.destructive} />
                            </Pressable>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function SectionCard({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function StatusRow({ ok, label, colors }: { ok: boolean; label: string; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  return (
    <View style={styles.statusRow}>
      <MaterialIcons name={ok ? 'check-circle' : 'error'} size={20} color={ok ? colors.accent : colors.destructive} />
      <Text style={[styles.statusLabel, { color: ok ? colors.accent : colors.destructive }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  content: { padding: 16, gap: 14 },
  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  runBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  issueText: { fontSize: 13, lineHeight: 20 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  statCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statName: { fontSize: 15, fontWeight: '700', flex: 1 },
  statMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  idxCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  idxTableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  idxTableName: { fontSize: 14, fontWeight: '700', flex: 1 },
  idxCount: { fontSize: 12 },
  noIndex: { fontSize: 13, paddingHorizontal: 12, paddingBottom: 12 },
  idxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  idxName: { fontSize: 13, flex: 1 },
  uniqueBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  uniqueText: { fontSize: 10, fontWeight: '700' },
});
