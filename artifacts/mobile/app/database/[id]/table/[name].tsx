/**
 * Table Viewer Screen
 * Tasks 2.8 (row edit/add/delete), 2.10 (import), 2.11 (BLOB), 2.13 (sort)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTableData, getColumns, getTableRowCount,
  ColumnInfo, insertRow, updateRow, deleteRow,
} from '@/utils/sqliteManager';
import { ResultGrid } from '@/components/ResultGrid';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { DatabaseErrorBoundary } from '@/components/DatabaseErrorBoundary';
import { RowEditorModal } from '@/components/RowEditorModal';
import { ImportModal } from '@/components/ImportModal';
import { ExportModal } from '@/components/ExportModal';
import { shareTextFile } from '@/utils/exportUtils';
import { exportTableToCSV, exportTableToJSON } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

type TabType = 'data' | 'structure';
type SortDir = 'ASC' | 'DESC';

function TableViewerInner() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const decodedName = name ? decodeURIComponent(name) : '';
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setCurrentSql } = useEditor();
  const { setActiveDbId, deleteDatabase } = useDatabases();

  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [colInfo, setColInfo] = useState<ColumnInfo[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Task 2.13 — Sort
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('ASC');

  // Task 2.8 — Row editor
  const [showRowEditor, setShowRowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [editingRow, setEditingRow] = useState<Record<string, unknown>>({});

  // Task 2.10 — Import
  const [showImport, setShowImport] = useState(false);

  // Task 2.3 — Export
  const [showExport, setShowExport] = useState(false);

  const PAGE_SIZE = 100;

  // Detect primary key column
  const pkCol = colInfo.find(c => c.pk > 0)?.name ?? null;

  const loadData = useCallback(async () => {
    if (!id || !decodedName) return;
    setIsLoading(true);
    try {
      const orderBy = sortCol ? ` ORDER BY "${sortCol}" ${sortDir}` : '';
      // We pass the sort via direct SQL override for the data page
      const [info, count] = await Promise.all([
        getColumns(id, decodedName),
        getTableRowCount(id, decodedName),
      ]);
      setColInfo(info);
      setRowCount(count);

      // Fetch page with optional sort
      const { rows: pageRows, columns: pageCols } = await getTableData(id, decodedName, PAGE_SIZE, page * PAGE_SIZE);
      // We re-run with sort if needed
      if (sortCol && pageRows.length > 0) {
        const { SQLiteDatabase } = await import('expo-sqlite');
      }
      setColumns(pageCols);
      setRows(pageRows);
    } catch (e) {
      Alert.alert('Error', `Could not load table: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [id, decodedName, page, sortCol, sortDir]);

  // Fetch with sort support
  const loadDataWithSort = useCallback(async () => {
    if (!id || !decodedName) return;
    setIsLoading(true);
    try {
      const [info, count] = await Promise.all([
        getColumns(id, decodedName),
        getTableRowCount(id, decodedName),
      ]);
      setColInfo(info);
      setRowCount(count);

      const { executeQuery } = await import('@/utils/sqliteManager');
      const orderBy = sortCol ? ` ORDER BY "${sortCol.replace(/"/g, '""')}" ${sortDir}` : '';
      const sql = `SELECT * FROM "${decodedName.replace(/"/g, '""')}"${orderBy} LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`;
      const result = await executeQuery(id, sql);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setColumns(result.columns);
        setRows(result.rows);
      }
    } catch (e) {
      Alert.alert('Error', `Could not load table: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [id, decodedName, page, sortCol, sortDir]);

  useEffect(() => { loadDataWithSort(); }, [loadDataWithSort]);

  // Task 2.13 — Toggle sort
  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortCol(col);
      setSortDir('ASC');
    }
    setPage(0);
  };

  const handleQueryTable = () => {
    if (id) {
      setActiveDbId(id);
      setCurrentSql(`SELECT * FROM "${decodedName}" LIMIT 100;`);
      router.push('/(tabs)/editor');
    }
  };

  // Task 2.8 — Add row
  const handleAddRow = () => {
    setEditorMode('add');
    setEditingRow({});
    setShowRowEditor(true);
  };

  // Task 2.8 — Edit row (long press)
  const handleEditRow = (row: Record<string, unknown>) => {
    setEditorMode('edit');
    setEditingRow(row);
    setShowRowEditor(true);
  };

  // Task 2.8 — Delete row
  const handleDeleteRow = (row: Record<string, unknown>) => {
    if (!pkCol) {
      Alert.alert('No Primary Key', 'Cannot delete rows without a primary key column.');
      return;
    }
    Alert.alert('Delete Row', `Delete this row? (${pkCol}=${row[pkCol]})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const r = await deleteRow(id, decodedName, pkCol, row[pkCol]);
          if (r.error) Alert.alert('Error', r.error);
          else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            loadDataWithSort();
          }
        },
      },
    ]);
  };

  const handleRowEditorConfirm = async (values: Record<string, string>) => {
    setShowRowEditor(false);
    if (!id) return;

    // Filter empty strings to null for optional fields
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      cleaned[k] = v === '' ? null : v;
    }

    let result;
    if (editorMode === 'add') {
      // Remove null values for add (let DB use defaults)
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cleaned)) {
        if (v !== null) filtered[k] = v;
      }
      result = await insertRow(id, decodedName, filtered);
    } else {
      if (!pkCol) { Alert.alert('Error', 'No primary key — cannot update.'); return; }
      result = await updateRow(id, decodedName, pkCol, editingRow[pkCol], cleaned);
    }

    if (result.error) Alert.alert('Error', result.error);
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadDataWithSort();
    }
  };

  // Task 2.3 — Export
  const handleExportTable = () => setShowExport(true);

  // Create a QueryResult-like object for ExportModal
  const tableQueryResult = { columns, rows, rowsAffected: 0, executionTime: 0, type: 'select' as const };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: decodedName,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4, marginRight: Platform.OS === 'ios' ? 0 : 8 }}>
              {/* Import (2.10) */}
              <Pressable onPress={() => setShowImport(true)} hitSlop={8} style={styles.headerBtn}>
                <MaterialIcons name="upload" size={20} color={colors.mutedForeground} />
              </Pressable>
              {/* Export (2.3) */}
              <Pressable onPress={handleExportTable} hitSlop={8} style={styles.headerBtn}>
                <MaterialIcons name="ios-share" size={20} color={colors.mutedForeground} />
              </Pressable>
              {/* Query in editor */}
              <Pressable onPress={handleQueryTable} hitSlop={8}>
                <MaterialIcons name="code" size={22} color={colors.primary} />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['data', 'structure'] as TabType[]).map(tab => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === 'data' ? `Data (${rowCount.toLocaleString()})` : 'Structure'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : activeTab === 'data' ? (
        <View style={{ flex: 1 }}>
          {/* Task 2.13 — Column sort bar */}
          {columns.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.sortBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              contentContainerStyle={styles.sortBarContent}
            >
              <Text style={[styles.sortBarLabel, { color: colors.mutedForeground }]}>Sort:</Text>
              {columns.map(col => (
                <Pressable
                  key={col}
                  onPress={() => handleSort(col)}
                  style={[
                    styles.sortChip,
                    {
                      backgroundColor: sortCol === col ? colors.primary + '22' : colors.muted,
                      borderColor: sortCol === col ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.sortChipText, { color: sortCol === col ? colors.primary : colors.mutedForeground }]}>
                    {col}
                    {sortCol === col ? (sortDir === 'ASC' ? ' ↑' : ' ↓') : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Task 2.8 — Row actions bar */}
          <View style={[styles.actionsBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <Pressable
              onPress={handleAddRow}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="add" size={16} color={colors.primaryForeground} />
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Add Row</Text>
            </Pressable>
            {pkCol && (
              <Text style={[styles.pkHint, { color: colors.mutedForeground }]}>
                Long press a row to edit/delete
              </Text>
            )}
          </View>

          {/* Task 2.8 — Rows with long-press edit/delete */}
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View>
              {/* Header */}
              <View style={[styles.gridHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {columns.map(col => (
                  <Pressable
                    key={col}
                    onPress={() => handleSort(col)}
                    style={[styles.gridHeaderCell, { borderRightColor: colors.border }]}
                  >
                    <Text style={[styles.gridHeaderText, { color: colors.foreground }]}>
                      {col}{sortCol === col ? (sortDir === 'ASC' ? ' ↑' : ' ↓') : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Rows */}
              <ScrollView>
                {rows.map((row, rIdx) => (
                  <Pressable
                    key={rIdx}
                    onLongPress={() => {
                      Alert.alert('Row Actions', undefined, [
                        { text: 'Edit Row', onPress: () => handleEditRow(row) },
                        { text: 'Delete Row', style: 'destructive', onPress: () => handleDeleteRow(row) },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                    style={[styles.gridRow, { backgroundColor: rIdx % 2 === 0 ? colors.background : colors.muted + '40', borderBottomColor: colors.border }]}
                  >
                    {columns.map(col => {
                      const val = row[col];
                      const isNull = val === null || val === undefined;
                      // Task 2.11 — BLOB detection
                      const isBlob = typeof val === 'object' && val !== null && !isNull;
                      return (
                        <View key={col} style={[styles.gridCell, { borderRightColor: colors.border }]}>
                          <Text
                            style={[
                              styles.gridCellText,
                              {
                                color: isNull ? colors.mutedForeground : isBlob ? colors.primary : colors.foreground,
                                fontStyle: isNull ? 'italic' : 'normal',
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {isNull ? 'NULL' : isBlob ? `[BLOB ${JSON.stringify(val).length}b]` : String(val)}
                          </Text>
                        </View>
                      );
                    })}
                  </Pressable>
                ))}
                {rows.length === 0 && (
                  <View style={styles.emptyRows}>
                    <Text style={[styles.emptyRowsText, { color: colors.mutedForeground }]}>
                      No rows in this table
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Pagination */}
          {rowCount > PAGE_SIZE && (
            <View style={[styles.pagination, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={[styles.pageBtn, { backgroundColor: colors.muted, opacity: page === 0 ? 0.4 : 1 }]}
              >
                <MaterialIcons name="chevron-left" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.pageText, { color: colors.mutedForeground }]}>
                Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowCount)} of {rowCount.toLocaleString()}
              </Text>
              <Pressable
                onPress={() => setPage(p => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= rowCount}
                style={[styles.pageBtn, { backgroundColor: colors.muted, opacity: (page + 1) * PAGE_SIZE >= rowCount ? 0.4 : 1 }]}
              >
                <MaterialIcons name="chevron-right" size={18} color={colors.foreground} />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        // Structure tab
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.structHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {['#', 'Name', 'Type', 'Not Null', 'Default', 'PK'].map((h, i) => (
              <Text key={h} style={[styles.structHeaderCell, { color: colors.mutedForeground, flex: i === 1 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {colInfo.map((col, idx) => (
            <View key={col.cid} style={[styles.structRow, { backgroundColor: idx % 2 === 0 ? colors.background : colors.card, borderBottomColor: colors.border }]}>
              <Text style={[styles.structCell, { color: colors.mutedForeground, flex: 1 }]}>{col.cid}</Text>
              <Text style={[styles.structCell, { color: colors.foreground, fontWeight: '600', flex: 2 }]}>{col.name}</Text>
              <Text style={[styles.structCell, { color: colors.primary, flex: 1 }]}>{col.type || 'ANY'}</Text>
              <Text style={[styles.structCell, { color: col.notnull ? colors.destructive : colors.mutedForeground, flex: 1 }]}>{col.notnull ? 'YES' : 'NO'}</Text>
              <Text style={[styles.structCell, { color: colors.mutedForeground, flex: 1 }]}>{col.dflt_value ?? '—'}</Text>
              <Text style={[styles.structCell, { color: col.pk ? colors.accent : colors.mutedForeground, flex: 1, fontWeight: col.pk ? '700' : '400' }]}>{col.pk ? 'YES' : '—'}</Text>
            </View>
          ))}
          {colInfo.length === 0 && (
            <View style={styles.noStructure}>
              <Text style={[styles.noStructureText, { color: colors.mutedForeground }]}>No column information available.</Text>
            </View>
          )}
          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <RowEditorModal
        visible={showRowEditor}
        mode={editorMode}
        columns={colInfo}
        initialValues={editingRow}
        onConfirm={handleRowEditorConfirm}
        onCancel={() => setShowRowEditor(false)}
      />

      <ImportModal
        visible={showImport}
        dbId={id ?? ''}
        tables={[decodedName]}
        onDone={() => { setShowImport(false); loadDataWithSort(); }}
        onCancel={() => setShowImport(false)}
      />

      <ExportModal
        visible={showExport}
        result={tableQueryResult}
        tableName={decodedName}
        onClose={() => setShowExport(false)}
      />
    </View>
  );
}

export default function TableViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string; name: string }>();
  const { deleteDatabase } = useDatabases();
  return (
    <DatabaseErrorBoundary onDeleteDatabase={id ? () => deleteDatabase(id) : undefined}>
      <TableViewerInner />
    </DatabaseErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { padding: 4 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sortBar: { borderBottomWidth: 1, maxHeight: 38, flexGrow: 0 },
  sortBarContent: { paddingHorizontal: 8, paddingVertical: 5, gap: 6, alignItems: 'center' },
  sortBarLabel: { fontSize: 11, fontWeight: '600', marginRight: 2 },
  sortChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '600' },
  actionsBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 8, borderBottomWidth: 1, gap: 10,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  pkHint: { fontSize: 11, flex: 1 },
  gridHeader: { flexDirection: 'row', borderBottomWidth: 1 },
  gridHeaderCell: { width: 120, paddingHorizontal: 10, paddingVertical: 8, borderRightWidth: 0.5 },
  gridHeaderText: { fontSize: 12, fontWeight: '700' },
  gridRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  gridCell: { width: 120, paddingHorizontal: 10, paddingVertical: 8, borderRightWidth: 0.5 },
  gridCellText: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  emptyRows: { padding: 32, alignItems: 'center' },
  emptyRowsText: { fontSize: 14 },
  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1,
  },
  pageBtn: { borderRadius: 8, padding: 6 },
  pageText: { fontSize: 13 },
  structHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  structHeaderCell: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  structRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  structCell: { fontSize: 13 },
  noStructure: { padding: 32, alignItems: 'center' },
  noStructureText: { fontSize: 14 },
});
