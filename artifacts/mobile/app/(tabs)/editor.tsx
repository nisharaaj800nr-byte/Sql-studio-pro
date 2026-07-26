/**
 * SQL Editor Screen
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
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  beginTransaction, commitTransaction, rollbackTransaction,
  isDestructiveSQL, exportDatabaseToSQL, explainQueryPlan, ExplainRow,
} from '@/utils/sqliteManager';
import { shareTextFile, backupDatabase } from '@/utils/exportUtils';

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

  // ── Multi-tab (2.2) ────────────────────────────────────────────────────────
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

  // ── Modal state ────────────────────────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  // ── Transaction state (2.18) ───────────────────────────────────────────────
  const [inTransaction, setInTransaction] = useState(false);
  const [txLoading, setTxLoading] = useState(false);

  // ── Explain state (2.19) ──────────────────────────────────────────────────
  const [explainRows, setExplainRows] = useState<ExplainRow[] | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  const activeDb = databases.find(d => d.id === activeDbId);

  // ── Keyboard shortcuts (2.5) ──────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowSaveModal(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        handleExplain();
      }
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

  // ── Task 2.20: Auto-backup before destructive SQL ──────────────────────────
  const runWithAutoBackup = useCallback(async () => {
    if (!activeDbId || !activeDb) { handlePickDatabase(); return; }

    if (isDestructiveSQL(currentSql)) {
      const go = await new Promise<boolean>(resolve => {
        Alert.alert(
          '⚠️ Destructive Query Detected',
          `This query contains DROP / DELETE / ALTER. An automatic SQL backup will be created before execution.\n\nProceed?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Backup & Run',
              style: 'destructive',
              onPress: async () => {
                try {
                  const sql = await exportDatabaseToSQL(activeDbId);
                  await shareTextFile(sql, `${activeDb.name}_auto_backup.sql`);
                } catch {
                  /* share may be cancelled — still proceed */
                }
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

  // ── Task 2.19: Explain query plan ─────────────────────────────────────────
  const handleExplain = useCallback(async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    const rows = await explainQueryPlan(activeDbId, currentSql);
    setExplainRows(rows);
    setShowExplain(true);
  }, [activeDbId, currentSql]);

  // ── Task 2.18: Transaction helpers ────────────────────────────────────────
  const handleBegin = async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    setTxLoading(true);
    const r = await beginTransaction(activeDbId);
    setTxLoading(false);
    if (r.error) Alert.alert('Error', r.error);
    else setInTransaction(true);
  };

  const handleCommit = async () => {
    if (!activeDbId) return;
    setTxLoading(true);
    const r = await commitTransaction(activeDbId);
    setTxLoading(false);
    if (r.error) Alert.alert('Error', r.error);
    else { setInTransaction(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  };

  const handleRollback = async () => {
    if (!activeDbId) return;
    setTxLoading(true);
    const r = await rollbackTransaction(activeDbId);
    setTxLoading(false);
    if (r.error) Alert.alert('Error', r.error);
    else { setInTransaction(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>

      {/* ── Tab bar (2.2) ─────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map(tab => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTabId(tab.id)}
            style={[
              styles.tab,
              tab.id === activeTabId && { borderBottomWidth: 2, borderBottomColor: colors.primary },
            ]}
          >
            <Text style={[styles.tabLabel, { color: tab.id === activeTabId ? colors.foreground : colors.mutedForeground }]}>
              {tab.label}
            </Text>
            {tabs.length > 1 && (
              <Pressable onPress={() => closeTab(tab.id)} hitSlop={6}>
                <MaterialIcons name="close" size={12} color={colors.mutedForeground} />
              </Pressable>
            )}
          </Pressable>
        ))}
        <Pressable onPress={addTab} style={styles.addTabBtn} hitSlop={8}>
          <MaterialIcons name="add" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handlePickDatabase}
          style={[styles.dbSelector, { backgroundColor: colors.muted, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="database" size={16} color={activeDb?.color ?? colors.mutedForeground} />
          <Text style={[styles.dbSelectorText, { color: activeDb ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
            {activeDb ? activeDb.name : 'Select database...'}
          </Text>
          <MaterialIcons name="unfold-more" size={14} color={colors.mutedForeground} />
        </Pressable>

        {/* Saved queries (2.4) */}
        <Pressable onPress={() => setShowSavedPanel(true)} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="bookmark-border" size={20} color={colors.mutedForeground} />
        </Pressable>

        {/* Explain (2.19) */}
        <Pressable onPress={handleExplain} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="account-tree" size={20} color={colors.mutedForeground} />
        </Pressable>

        {/* History */}
        <Pressable onPress={() => router.push('/(tabs)/history')} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="history" size={20} color={colors.mutedForeground} />
        </Pressable>

        {/* Save query */}
        <Pressable onPress={() => setShowSaveModal(true)} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="save-alt" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
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

      {/* ── Transaction bar (2.18) ─────────────────────────────────────────── */}
      <TransactionBar
        inTransaction={inTransaction}
        isLoading={txLoading}
        onBegin={handleBegin}
        onCommit={handleCommit}
        onRollback={handleRollback}
      />

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <View style={[styles.divider, { backgroundColor: colors.border }]}>
        <View style={[styles.dividerHandle, { backgroundColor: colors.card }]}>
          <MaterialIcons name="drag-handle" size={18} color={colors.mutedForeground} />
        </View>
      </View>

      {/* ── Results / Explain plan ─────────────────────────────────────────── */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background }]}>
        {showExplain && explainRows ? (
          <ExplainPanel rows={explainRows} onClose={() => setShowExplain(false)} colors={colors} />
        ) : queryResult ? (
          <ResultGrid
            result={queryResult}
            onExport={() => setShowExport(true)}
          />
        ) : (
          <EmptyState
            icon="table-chart"
            title="No Results"
            description={activeDb ? 'Write a SQL query above and press Run' : 'Select a database, then write a query and press Run'}
          />
        )}
      </View>

      {Platform.OS === 'web' && <View style={{ height: 34 }} />}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
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

// ── Task 2.19: Explain Plan Panel ───────────────────────────────────────────

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
        <MaterialIcons name="account-tree" size={16} color={colors.primary} />
        <Text style={[epStyles.title, { color: colors.foreground }]}>EXPLAIN QUERY PLAN</Text>
        <Pressable onPress={onClose} hitSlop={8} style={{ marginLeft: 'auto' }}>
          <MaterialIcons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {rows.length === 0 ? (
          <View style={epStyles.empty}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>No plan available for this query.</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  empty: { padding: 32, alignItems: 'center' },
  row: { padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detail: { fontSize: 13, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  meta: { fontSize: 10, marginTop: 2 },
});

// ── Task 1.5: Wrapper ────────────────────────────────────────────────────────

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
  tabBar: { borderBottomWidth: 1, maxHeight: 40, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 4, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, marginRight: 2,
  },
  tabLabel: { fontSize: 12, fontWeight: '500' },
  addTabBtn: { padding: 8 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 8, borderBottomWidth: 1, gap: 6,
  },
  dbSelector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  dbSelectorText: { flex: 1, fontSize: 14, fontWeight: '500' },
  iconBtn: { padding: 6 },
  editorContainer: { flex: 1 },
  divider: { height: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  dividerHandle: {
    position: 'absolute', borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  resultsContainer: { flex: 1 },
});
