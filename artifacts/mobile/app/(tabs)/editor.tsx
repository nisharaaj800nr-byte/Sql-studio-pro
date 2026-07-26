/**
 * SQL Editor Screen — Mobile-first, professional layout
 * Tasks 2.2 (multi-tab), 2.3 (export), 2.4 (saved queries), 2.5 (kb shortcuts),
 * 2.18 (transaction UI), 2.19 (explain plan), 2.20 (auto-backup)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { InputModal } from '@/components/InputModal';
import { DatabaseErrorBoundary } from '@/components/DatabaseErrorBoundary';
import { ExportModal } from '@/components/ExportModal';
import { SavedQueriesPanel } from '@/components/SavedQueriesPanel';
import { TransactionBar } from '@/components/TransactionBar';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { SQLEditor } from '@/components/SQLEditor';
import { ResultGrid } from '@/components/ResultGrid';
import { EmptyState } from '@/components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  beginTransaction, commitTransaction, rollbackTransaction,
  isDestructiveSQL, exportDatabaseToSQL, explainQueryPlan, ExplainRow,
} from '@/utils/sqliteManager';
import { shareTextFile } from '@/utils/exportUtils';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 78 : 56;

// ── Multi-tab state ──────────────────────────────────────────────────────────

interface EditorTab {
  id: string;
  label: string;
  sql: string;
}

let tabSeq = 1;
const newTab = (sql = ''): EditorTab => ({ id: `t${tabSeq++}`, label: `Query ${tabSeq - 1}`, sql });

// ── Screen ───────────────────────────────────────────────────────────────────

function EditorInner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, activeDbId, setActiveDbId, deleteDatabase } = useDatabases();
  const {
    queryResult,
    isExecuting,
    executeQuery,
    saveQuery,
    savedQueries,
    deleteSavedQuery,
  } = useEditor();

  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: 't0', label: 'Query 1', sql: "-- Welcome to SQL Studio Pro\nSELECT * FROM sqlite_master WHERE type = 'table';" },
  ]);
  const [activeTabId, setActiveTabId] = useState('t0');

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const currentSql = activeTab?.sql ?? '';

  const updateTabSql = (sql: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, sql } : t));
  };

  const addTab = () => {
    const tab = newTab();
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[Math.max(0, idx - 1)].id);
    }
  };

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  const [inTransaction, setInTransaction] = useState(false);
  const [txLoading, setTxLoading] = useState(false);

  const [explainRows, setExplainRows] = useState<ExplainRow[] | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  const activeDb = databases.find(d => d.id === activeDbId);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowSaveModal(true); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'e') { e.preventDefault(); handleExplain(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSql, activeDbId, activeDb]);

  const handlePickDatabase = () => {
    if (databases.length === 0) {
      Alert.alert('No Databases', 'Create a database first.', [
        { text: 'Create', onPress: () => router.push('/(tabs)/databases') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(
      'Select Database',
      'Choose which database to query:',
      [
        ...databases.map(db => ({
          text: db.name,
          onPress: () => {
            setActiveDbId(db.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const runWithAutoBackup = useCallback(async () => {
    if (!activeDbId || !activeDb) { handlePickDatabase(); return; }

    if (isDestructiveSQL(currentSql)) {
      const go = await new Promise<boolean>(resolve => {
        Alert.alert(
          '⚠️ Destructive Query',
          `This query contains DROP / DELETE / ALTER. A SQL backup will be created before execution.\n\nProceed?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Backup & Run',
              style: 'destructive',
              onPress: async () => {
                try {
                  const sql = await exportDatabaseToSQL(activeDbId);
                  await shareTextFile(sql, `${activeDb.name}_auto_backup.sql`);
                } catch { /* share may be cancelled — still proceed */ }
                resolve(true);
              },
            },
          ]
        );
      });
      if (!go) return;
    }

    await executeQuery(activeDbId, activeDb.name, currentSql);
    setExplainRows(null);
    setShowExplain(false);
  }, [activeDbId, activeDb, currentSql, executeQuery]);

  const handleRun = runWithAutoBackup;

  const handleSaveConfirm = async (name: string) => {
    setShowSaveModal(false);
    await saveQuery(name, currentSql, activeDbId ?? undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExplain = useCallback(async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    try {
      const rows = await explainQueryPlan(activeDbId, currentSql);
      setExplainRows(rows);
      setShowExplain(true);
    } catch {
      // incomplete or invalid SQL — silently ignore
    }
  }, [activeDbId, currentSql]);

  const handleBegin = async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    setTxLoading(true);
    try {
      const r = await beginTransaction(activeDbId);
      if (r.error) Alert.alert('Error', r.error);
      else setInTransaction(true);
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not begin transaction.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!activeDbId) return;
    setTxLoading(true);
    try {
      const r = await commitTransaction(activeDbId);
      if (r.error) Alert.alert('Error', r.error);
      else { setInTransaction(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not commit transaction.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!activeDbId) return;
    setTxLoading(true);
    try {
      const r = await rollbackTransaction(activeDbId);
      if (r.error) Alert.alert('Error', r.error);
      else { setInTransaction(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not roll back transaction.');
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>

      {/* ── Combined header: DB selector + query tabs + actions ─── */}
      <View style={[styles.topArea, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

        {/* DB selector row — single compact line */}
        <View style={styles.dbRow}>
          <Pressable
            onPress={handlePickDatabase}
            style={[styles.dbSelector, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <View style={[styles.dbDot, { backgroundColor: activeDb?.color ?? colors.mutedForeground }]} />
            <Text style={[styles.dbSelectorText, { color: activeDb ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
              {activeDb ? activeDb.name : 'Select database…'}
            </Text>
            <Ionicons name="chevron-down" size={11} color={colors.mutedForeground} />
          </Pressable>

          <Pressable onPress={() => setShowSavedPanel(true)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="bookmark-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={handleExplain} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="git-network-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={() => setShowSaveModal(true)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="save-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTabId(tab.id)}
              style={[
                styles.tab,
                tab.id === activeTabId && [styles.tabActive, { borderBottomColor: colors.primary }],
              ]}
            >
              <Text style={[
                styles.tabLabel,
                { color: tab.id === activeTabId ? colors.foreground : colors.mutedForeground },
              ]}>
                {tab.label}
              </Text>
              {tabs.length > 1 && (
                <Pressable onPress={() => closeTab(tab.id)} hitSlop={6}>
                  <Ionicons name="close" size={10} color={colors.mutedForeground} />
                </Pressable>
              )}
            </Pressable>
          ))}
          <Pressable onPress={addTab} style={styles.addTabBtn} hitSlop={8}>
            <Ionicons name="add" size={15} color={colors.mutedForeground} />
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Transaction bar ─────────────────────────────────────────── */}
      <TransactionBar
        inTransaction={inTransaction}
        isLoading={txLoading}
        onBegin={handleBegin}
        onCommit={handleCommit}
        onRollback={handleRollback}
      />

      {/* ── Editor ────────────────────────────────────────────────── */}
      <View style={styles.editorContainer}>
        <SQLEditor
          value={currentSql}
          onChange={updateTabSql}
          onRun={handleRun}
          isExecuting={isExecuting}
          databaseName={activeDb?.name}
          databaseId={activeDbId}
          databaseColor={activeDb?.color}
        />
      </View>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <View style={[styles.divider, { backgroundColor: colors.border }]}>
        <View style={[styles.dividerHandle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="remove" size={14} color={colors.mutedForeground} />
        </View>
      </View>

      {/* ── Results / Explain plan ────────────────────────────────────── */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}>
        {showExplain && explainRows ? (
          <ExplainPanel rows={explainRows} onClose={() => setShowExplain(false)} colors={colors} />
        ) : queryResult ? (
          <ResultGrid result={queryResult} onExport={() => setShowExport(true)} />
        ) : (
          <EmptyState
            icon="table-chart"
            title="No Results"
            description={activeDb ? 'Write a query above and press Run' : 'Select a database, then write a query'}
          />
        )}
      </View>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <InputModal
        visible={showSaveModal}
        title="Save Query"
        message="Give this query a name so you can find it later."
        placeholder="e.g. Get all users, Monthly sales"
        confirmLabel="Save"
        onConfirm={handleSaveConfirm}
        onCancel={() => setShowSaveModal(false)}
      />

      {queryResult && (
        <ExportModal
          visible={showExport}
          result={queryResult}
          tableName={activeDb?.name ?? 'results'}
          onClose={() => setShowExport(false)}
        />
      )}

      <SavedQueriesPanel
        visible={showSavedPanel}
        savedQueries={savedQueries}
        onInsert={sql => { updateTabSql(sql); }}
        onDelete={deleteSavedQuery}
        onClose={() => setShowSavedPanel(false)}
      />
    </View>
  );
}

// ── Explain Plan Panel ───────────────────────────────────────────────────────

function ExplainPanel({
  rows,
  onClose,
  colors,
}: {
  rows: ExplainRow[];
  onClose: () => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[epStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Ionicons name="git-network-outline" size={13} color={colors.primary} />
        <Text style={[epStyles.title, { color: colors.foreground }]}>EXPLAIN QUERY PLAN</Text>
        <Pressable onPress={onClose} hitSlop={8} style={{ marginLeft: 'auto' }}>
          <Ionicons name="close" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {rows.length === 0 ? (
          <View style={epStyles.empty}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No plan available for this query.</Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View key={i} style={[epStyles.row, { borderBottomColor: colors.border, paddingLeft: 12 + row.parent * 16 }]}>
              <Text style={[epStyles.detail, { color: colors.foreground }]}>{row.detail}</Text>
              <Text style={[epStyles.meta, { color: colors.mutedForeground }]}>id:{row.id} parent:{row.parent}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const epStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  empty: { padding: 28, alignItems: 'center' },
  row: { padding: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  detail: { fontSize: 12, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  meta: { fontSize: 10, marginTop: 2 },
});

// ── Wrapper ──────────────────────────────────────────────────────────────────

export default function EditorScreen() {
  const { activeDbId, deleteDatabase } = useDatabases();
  return (
    <DatabaseErrorBoundary onDeleteDatabase={activeDbId ? () => deleteDatabase(activeDbId) : undefined}>
      <EditorInner />
    </DatabaseErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Combined top area (db selector + tabs)
  topArea: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 3,
    gap: 2,
  },
  dbDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dbSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dbSelectorText: { flex: 1, fontSize: 12, fontWeight: '500' },
  iconBtn: { padding: 5 },

  tabBar: { maxHeight: 32, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabLabel: { fontSize: 11, fontWeight: '500' },
  addTabBtn: { padding: 7 },

  editorContainer: { flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dividerHandle: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  resultsContainer: { flex: 1 },
});
