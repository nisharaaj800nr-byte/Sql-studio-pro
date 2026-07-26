/**
 * SQL Editor Screen — Mobile-first professional SQL IDE
 * Features: multi-tab, transaction management, explain plan,
 * auto-backup, keyboard shortcuts, export, saved queries
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
  unsaved?: boolean;
}

let tabSeq = 1;
const newTab = (sql = ''): EditorTab => ({
  id: `t${tabSeq++}`,
  label: `Query ${tabSeq - 1}`,
  sql,
  unsaved: false,
});

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
    { id: 't0', label: 'Query 1', sql: "-- Welcome to SQL Studio Pro\nSELECT * FROM sqlite_master WHERE type = 'table';", unsaved: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('t0');

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const currentSql = activeTab?.sql ?? '';

  const updateTabSql = (sql: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, sql, unsaved: true } : t));
  };

  const addTab = () => {
    const tab = newTab();
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[Math.max(0, idx - 1)].id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  const [inTransaction, setInTransaction] = useState(false);
  const [txLoading, setTxLoading] = useState(false);

  const [explainRows, setExplainRows] = useState<ExplainRow[] | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  const activeDb = databases.find(d => d.id === activeDbId);

  // Keyboard shortcuts (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowSaveModal(true); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'e') { e.preventDefault(); handleExplain(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); addTab(); }
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
          text: `${db.name}${db.id === activeDbId ? ' ✓' : ''}`,
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
          `This query contains DROP / DELETE / ALTER.\nA SQL backup will be created before execution.\n\nProceed?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Backup & Run',
              style: 'destructive',
              onPress: async () => {
                try {
                  const sql = await exportDatabaseToSQL(activeDbId);
                  await shareTextFile(sql, `${activeDb.name}_auto_backup.sql`);
                } catch { /* share may be cancelled */ }
                resolve(true);
              },
            },
          ]
        );
      });
      if (!go) return;
    }

    await executeQuery(activeDbId, activeDb.name, currentSql);
    // Mark tab as saved after run
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, unsaved: false } : t));
    setExplainRows(null);
    setShowExplain(false);
  }, [activeTabId, activeDbId, activeDb, currentSql, executeQuery]);

  const handleRun = runWithAutoBackup;

  const handleSaveConfirm = async (name: string) => {
    setShowSaveModal(false);
    await saveQuery(name, currentSql, activeDbId ?? undefined);
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, unsaved: false } : t));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExplain = useCallback(async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    try {
      const rows = await explainQueryPlan(activeDbId, currentSql);
      setExplainRows(rows);
      setShowExplain(true);
    } catch {
      // incomplete SQL — silently ignore
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
      Alert.alert('Error', (e as Error).message ?? 'Could not commit.');
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
      Alert.alert('Error', (e as Error).message ?? 'Could not roll back.');
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>

      {/* ── Top area: DB selector + tabs + actions ───────────────── */}
      <View style={[styles.topArea, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

        {/* DB selector row */}
        <View style={styles.dbRow}>
          <Pressable
            onPress={handlePickDatabase}
            style={[styles.dbSelector, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <View style={[styles.dbDot, { backgroundColor: activeDb?.color ?? colors.mutedForeground }]} />
            <Text
              style={[styles.dbSelectorText, { color: activeDb ? colors.foreground : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {activeDb ? activeDb.name : 'Select database…'}
            </Text>
            <Ionicons name="chevron-down" size={11} color={colors.mutedForeground} />
          </Pressable>

          {/* Action buttons */}
          <Pressable
            onPress={() => setShowSavedPanel(true)}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Ionicons name="bookmark-outline" size={15} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={handleExplain}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Ionicons name="git-network-outline" size={15} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => setShowSaveModal(true)}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Ionicons name="save-outline" size={15} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map(tab => {
            const active = tab.id === activeTabId;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTabId(tab.id)}
                style={[
                  styles.tab,
                  active && [styles.tabActive, { borderBottomColor: colors.primary, backgroundColor: colors.primary + '0C' }],
                ]}
              >
                {tab.unsaved && (
                  <View style={[styles.unsavedDot, { backgroundColor: active ? colors.primary : colors.mutedForeground }]} />
                )}
                <Text style={[
                  styles.tabLabel,
                  { color: active ? colors.foreground : colors.mutedForeground, fontWeight: active ? '600' : '400' },
                ]}>
                  {tab.label}
                </Text>
                {tabs.length > 1 && (
                  <Pressable onPress={() => closeTab(tab.id)} hitSlop={6} style={styles.closeTabBtn}>
                    <Ionicons name="close" size={11} color={active ? colors.mutedForeground : colors.mutedForeground + '80'} />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
          <Pressable onPress={addTab} style={styles.addTabBtn} hitSlop={8}>
            <Ionicons name="add" size={15} color={colors.mutedForeground} />
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Transaction bar ──────────────────────────────────────── */}
      <TransactionBar
        inTransaction={inTransaction}
        isLoading={txLoading}
        onBegin={handleBegin}
        onCommit={handleCommit}
        onRollback={handleRollback}
      />

      {/* ── Editor ──────────────────────────────────────────────── */}
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

      {/* ── Resizable divider ────────────────────────────────────── */}
      <View style={[styles.divider, { backgroundColor: colors.border }]}>
        <View style={[styles.dividerHandle, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Ionicons name="remove" size={14} color={colors.mutedForeground} />
        </View>
      </View>

      {/* ── Results / Explain plan ──────────────────────────────── */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}>
        {showExplain && explainRows ? (
          <ExplainPanel rows={explainRows} onClose={() => setShowExplain(false)} colors={colors} />
        ) : queryResult ? (
          <ResultGrid result={queryResult} onExport={() => setShowExport(true)} />
        ) : (
          <EmptyState
            icon="table-chart"
            title="No Results Yet"
            description={activeDb ? 'Write a query above and press Run ▶' : 'Select a database, then write a query'}
          />
        )}
      </View>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <InputModal
        visible={showSaveModal}
        title="Save Query"
        message="Give this query a name to find it later."
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
        onInsert={sql => { updateTabSql(sql); setShowSavedPanel(false); }}
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
        <View style={[epStyles.iconWrap, { backgroundColor: colors.info + '18' }]}>
          <Ionicons name="git-network-outline" size={14} color={colors.info} />
        </View>
        <Text style={[epStyles.title, { color: colors.foreground }]}>EXPLAIN QUERY PLAN</Text>
        <Pressable onPress={onClose} hitSlop={10} style={[epStyles.closeBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="close" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {rows.length === 0 ? (
          <View style={epStyles.empty}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No plan available for this query.</Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View
              key={i}
              style={[
                epStyles.row,
                {
                  borderBottomColor: colors.border,
                  paddingLeft: 14 + row.parent * 18,
                  backgroundColor: i % 2 === 0 ? 'transparent' : colors.muted + '40',
                },
              ]}
            >
              <View style={epStyles.rowBullet}>
                <View style={[epStyles.bullet, { backgroundColor: colors.primary + '60' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[epStyles.detail, { color: colors.foreground }]}>{row.detail}</Text>
                <Text style={[epStyles.meta, { color: colors.mutedForeground }]}>
                  Node {row.id}{row.parent > 0 ? ` · parent ${row.parent}` : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const epStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  closeBtn: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 28, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowBullet: { paddingTop: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
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

  // Combined top area
  topArea: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 5,
  },
  dbDot: { width: 7, height: 7, borderRadius: 4 },
  dbSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dbSelectorText: { flex: 1, fontSize: 12, fontWeight: '500' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Tabs
  tabBar: { maxHeight: 34, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderRadius: 6,
  },
  tabActive: { borderRadius: 0 },
  unsavedDot: { width: 5, height: 5, borderRadius: 3 },
  tabLabel: { fontSize: 11 },
  closeTabBtn: { marginLeft: 1 },
  addTabBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },

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
    paddingHorizontal: 14,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  resultsContainer: { flex: 1 },
});
