/**
 * SQL Editor Screen — Premium IDE
 * All colors sourced from useColors() — fully theme-aware (dark / light / system).
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { DatabaseErrorBoundary } from '@/components/DatabaseErrorBoundary';
import { ExportModal } from '@/components/ExportModal';
import { SavedQueriesPanel } from '@/components/SavedQueriesPanel';
import { InputModal } from '@/components/InputModal';
import { SQLEditor } from '@/components/SQLEditor';
import { ResultGrid } from '@/components/ResultGrid';

import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { useColors } from '@/hooks/useColors';

import {
  beginTransaction, commitTransaction, rollbackTransaction,
  isDestructiveSQL, exportDatabaseToSQL, explainQueryPlan, ExplainRow,
} from '@/utils/sqliteManager';
import { shareTextFile } from '@/utils/exportUtils';

// ── Brand accent (decorative tab underline — not a surface/text color) ────────
const PURPLE = '#7C5CFF';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 60;

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

// ── Premium "No Results Yet" illustration ────────────────────────────────────

function PremiumNoResults({ dbSelected }: { dbSelected: boolean }) {
  const c = useColors();
  return (
    <View style={[nr.container, { backgroundColor: c.card }]}>
      {/* Glow illustration */}
      <View style={nr.glowWrap}>
        {/* Outer elliptical glow */}
        <View style={[nr.glowRing3, { backgroundColor: c.primary, shadowColor: c.primary }]} />
        <View style={[nr.glowRing2, { backgroundColor: c.primary, shadowColor: c.primary }]} />
        <View style={[nr.glowRing1, { backgroundColor: c.primary, shadowColor: c.primary }]} />

        {/* Icon box */}
        <View style={[nr.iconBox, { shadowColor: c.primary }]}>
          {/* Blue border glow */}
          <LinearGradient
            colors={['#1A3470', '#0F1B3E']}
            style={nr.iconGradient}
          >
            {/* 2×2 grid of squares */}
            <View style={nr.grid}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[
                    nr.square,
                    { opacity: i < 2 ? 1 : 0.65 },
                  ]}
                />
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>

      <Text style={[nr.title, { color: c.foreground }]}>No Results Yet</Text>
      <Text style={[nr.subtitle, { color: c.mutedForeground }]}>
        {dbSelected
          ? 'Write a query above and press Run ▶'
          : 'Select a database, then write a query'}
      </Text>
    </View>
  );
}

const nr = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    gap: 0,
  },
  glowWrap: {
    width: 180,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  glowRing3: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    height: 28,
    borderRadius: 20,
    opacity: 0.08,
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  glowRing2: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    height: 20,
    borderRadius: 14,
    opacity: 0.14,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  glowRing1: {
    position: 'absolute',
    bottom: 22,
    left: 44,
    right: 44,
    height: 14,
    borderRadius: 10,
    opacity: 0.22,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  iconBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    overflow: 'hidden',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
    borderWidth: 1,
    borderColor: '#1E3A8A55',
  },
  iconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    width: 46,
    height: 46,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  square: {
    width: 19,
    height: 19,
    borderRadius: 5,
    backgroundColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Explain plan panel ───────────────────────────────────────────────────────

function ExplainPanel({
  rows,
  onClose,
}: {
  rows: ExplainRow[];
  onClose: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.card }}>
      <View style={[ep.header, { borderBottomColor: c.border }]}>
        <View style={[ep.iconWrap, { backgroundColor: c.primary + '18' }]}>
          <Ionicons name="git-network-outline" size={14} color={c.primary} />
        </View>
        <Text style={[ep.title, { color: c.foreground }]}>EXPLAIN QUERY PLAN</Text>
        <Pressable onPress={onClose} hitSlop={10} style={[ep.close, { backgroundColor: c.muted }]}>
          <Ionicons name="close" size={14} color={c.mutedForeground} />
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {rows.length === 0 ? (
          <View style={ep.empty}>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>No plan available for this query.</Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View
              key={i}
              style={[ep.row, {
                borderBottomColor: c.border,
                paddingLeft: 14 + row.parent * 18,
                backgroundColor: i % 2 === 0 ? 'transparent' : c.muted + '40',
              }]}
            >
              <View style={{ paddingTop: 6 }}>
                <View style={[ep.bullet, { backgroundColor: c.primary + '60' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontSize: 12, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{row.detail}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 10, marginTop: 2 }}>Node {row.id}{row.parent > 0 ? ` · parent ${row.parent}` : ''}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const ep = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  close: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 28, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
});

// ── Main editor inner ────────────────────────────────────────────────────────

function EditorInner() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { databases, activeDbId, setActiveDbId } = useDatabases();
  const { queryResult, isExecuting, executeQuery, saveQuery, savedQueries, deleteSavedQuery } = useEditor();

  // Tabs
  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: 't0', label: 'Query 1', sql: "-- Welcome to SQL Studio Pro\nSELECT * FROM sqlite_master WHERE type = 'table';", unsaved: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('t0');
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const currentSql = activeTab?.sql ?? '';

  const updateTabSql = (sql: string) =>
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, sql, unsaved: true } : t));

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
    if (activeTabId === id) setActiveTabId(remaining[Math.max(0, idx - 1)].id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExport, setShowExport]       = useState(false);
  const [showSaved, setShowSaved]         = useState(false);

  // Transaction
  const [inTransaction, setInTransaction] = useState(false);
  const [txLoading, setTxLoading]         = useState(false);

  // Explain plan
  const [explainRows, setExplainRows]     = useState<ExplainRow[] | null>(null);
  const [showExplain, setShowExplain]     = useState(false);

  const activeDb = databases.find(d => d.id === activeDbId);

  // Keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's')     { e.preventDefault(); setShowSaveModal(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 't')     { e.preventDefault(); addTab(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSql, activeDbId]);

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
          onPress: () => { setActiveDbId(db.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRun = useCallback(async () => {
    if (!activeDbId || !activeDb) { handlePickDatabase(); return; }
    if (isDestructiveSQL(currentSql)) {
      const go = await new Promise<boolean>(resolve => {
        Alert.alert(
          '⚠️ Destructive Query',
          'This query contains DROP / DELETE / ALTER.\nA SQL backup will be created before execution.\n\nProceed?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Backup & Run', style: 'destructive',
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
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, unsaved: false } : t));
    setExplainRows(null);
    setShowExplain(false);
  }, [activeTabId, activeDbId, activeDb, currentSql, executeQuery]);

  const handleExplain = useCallback(async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    try {
      const rows = await explainQueryPlan(activeDbId, currentSql);
      setExplainRows(rows);
      setShowExplain(true);
    } catch { /* incomplete SQL */ }
  }, [activeDbId, currentSql]);

  const handleBegin = async () => {
    if (!activeDbId) { handlePickDatabase(); return; }
    setTxLoading(true);
    try {
      const r = await beginTransaction(activeDbId);
      if (r.error) Alert.alert('Error', r.error);
      else setInTransaction(true);
    } catch (e) { Alert.alert('Error', (e as Error).message); }
    finally { setTxLoading(false); }
  };

  const handleCommit = async () => {
    if (!activeDbId) return;
    setTxLoading(true);
    try {
      const r = await commitTransaction(activeDbId);
      if (r.error) Alert.alert('Error', r.error);
      else { setInTransaction(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    } catch (e) { Alert.alert('Error', (e as Error).message); }
    finally { setTxLoading(false); }
  };

  const handleRollback = async () => {
    if (!activeDbId) return;
    setTxLoading(true);
    try {
      const r = await rollbackTransaction(activeDbId);
      if (r.error) Alert.alert('Error', r.error);
      else { setInTransaction(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }
    } catch (e) { Alert.alert('Error', (e as Error).message); }
    finally { setTxLoading(false); }
  };

  return (
    <View style={[s.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>

      {/* ── DB selector row ──────────────────────────────────────── */}
      <View style={[s.dbRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {/* Selector pill */}
        <Pressable
          onPress={handlePickDatabase}
          style={({ pressed }) => [
            s.dbSelector,
            { opacity: pressed ? 0.8 : 1, borderColor: c.border, backgroundColor: c.muted },
          ]}
        >
          {/* Cylinder icon */}
          <View style={s.dbIconWrap}>
            <Ionicons name="server-outline" size={15} color={c.primary} />
          </View>
          <Text style={[s.dbSelectorText, { color: activeDb ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
            {activeDb ? activeDb.name : 'Select database...'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={c.mutedForeground} />
        </Pressable>

        {/* Action icon buttons */}
        <Pressable
          onPress={() => setShowSaved(true)}
          style={[s.iconBtn, { backgroundColor: c.muted, borderColor: c.border }]}
          hitSlop={8}
        >
          <Ionicons name="bookmark-outline" size={16} color={c.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={handleExplain}
          style={[s.iconBtn, { backgroundColor: c.muted, borderColor: c.border }]}
          hitSlop={8}
        >
          <Ionicons name="funnel-outline" size={16} color={c.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => setShowSaveModal(true)}
          style={[s.iconBtn, { backgroundColor: c.muted, borderColor: c.border }]}
          hitSlop={8}
        >
          <Ionicons name="save-outline" size={16} color={c.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <View style={[s.tabBarWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
          keyboardShouldPersistTaps="always"
        >
          {tabs.map(tab => {
            const active = tab.id === activeTabId;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTabId(tab.id)}
                style={[s.tab, active && s.tabActive]}
              >
                {tab.unsaved && (
                  <View style={[s.unsavedDot, { backgroundColor: active ? c.primary : c.mutedForeground }]} />
                )}
                <Text style={[s.tabLabel, {
                  color: active ? c.foreground : c.mutedForeground,
                  fontWeight: active ? '600' : '400',
                }]}>
                  {tab.label}
                </Text>
                {tabs.length > 1 && (
                  <Pressable onPress={() => closeTab(tab.id)} hitSlop={6} style={s.closeTabBtn}>
                    <Ionicons name="close" size={11} color={active ? c.mutedForeground : c.mutedForeground + '80'} />
                  </Pressable>
                )}
                {/* Active underline */}
                {active && <View style={[s.tabUnderline, { backgroundColor: PURPLE }]} />}
              </Pressable>
            );
          })}
          <Pressable onPress={addTab} style={s.addTabBtn} hitSlop={8}>
            <Ionicons name="add" size={16} color={c.mutedForeground} />
          </Pressable>
        </ScrollView>
      </View>

      {/* ── SQL Editor (toolbar + code + info + chips) ──────────── */}
      <View style={[s.editorContainer, { backgroundColor: c.background }]}>
        <SQLEditor
          value={currentSql}
          onChange={updateTabSql}
          onRun={handleRun}
          isExecuting={isExecuting}
          databaseName={activeDb?.name}
          databaseId={activeDbId}
          databaseColor={activeDb?.color}
          inTransaction={inTransaction}
          txLoading={txLoading}
          onBegin={handleBegin}
          onCommit={handleCommit}
          onRollback={handleRollback}
          onOpenSettings={() => router.push('/(tabs)/settings')}
        />
      </View>

      {/* ── Results area ─────────────────────────────────────────── */}
      <View style={[s.results, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}>
        {showExplain && explainRows ? (
          <ExplainPanel rows={explainRows} onClose={() => setShowExplain(false)} />
        ) : queryResult ? (
          <ResultGrid result={queryResult} onExport={() => setShowExport(true)} />
        ) : (
          <PremiumNoResults dbSelected={!!activeDb} />
        )}
      </View>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <InputModal
        visible={showSaveModal}
        title="Save Query"
        message="Give this query a name to find it later."
        placeholder="e.g. Get all users"
        confirmLabel="Save"
        onConfirm={async name => {
          setShowSaveModal(false);
          await saveQuery(name, currentSql, activeDbId ?? undefined);
          setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, unsaved: false } : t));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
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
        visible={showSaved}
        savedQueries={savedQueries}
        onInsert={sql => { updateTabSql(sql); setShowSaved(false); }}
        onDelete={deleteSavedQuery}
        onClose={() => setShowSaved(false)}
      />
    </View>
  );
}

// ── Wrapper ──────────────────────────────────────────────────────────────────

export default function EditorScreen() {
  const { activeDbId, deleteDatabase } = useDatabases();
  return (
    <DatabaseErrorBoundary onDeleteDatabase={activeDbId ? () => deleteDatabase(activeDbId) : undefined}>
      <EditorInner />
    </DatabaseErrorBoundary>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },

  // DB selector row
  dbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  dbSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
  },
  dbIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dbSelectorText: { flex: 1, fontSize: 13, fontWeight: '500' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab bar
  tabBarWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    alignItems: 'flex-end',
    gap: 2,
    minHeight: 38,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'relative',
  },
  tabActive: {},
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  unsavedDot: { width: 5, height: 5, borderRadius: 2.5 },
  tabLabel: { fontSize: 12 },
  closeTabBtn: { marginLeft: 0 },
  addTabBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  // Editor / results split
  editorContainer: { flex: 2, minHeight: 180 },
  results: { flex: 1.2, minHeight: 160 },
});
