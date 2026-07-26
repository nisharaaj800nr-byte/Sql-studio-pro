import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { QueryResult } from '@/utils/sqliteManager';
import { formatDuration } from '@/utils/formatters';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const COL_MIN_WIDTH = 90;
const COL_MAX_WIDTH = 260;
const ROW_NUM_WIDTH = 40;

interface ResultGridProps {
  result: QueryResult;
  onExport?: () => void;
}

function getColWidth(colName: string, rows: Record<string, unknown>[]): number {
  const headerLen = colName.length * 8 + 28;
  const maxDataLen = Math.min(
    Math.max(...rows.slice(0, 50).map(r => String(r[colName] ?? '').length * 7 + 24)),
    COL_MAX_WIDTH
  );
  return Math.max(COL_MIN_WIDTH, headerLen, maxDataLen);
}

export function ResultGrid({ result, onExport }: ResultGridProps) {
  const colors = useColors();
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);

  const handleCopyCell = async (value: unknown) => {
    if (value === null || value === undefined) return;
    try {
      await Clipboard.setStringAsync(String(value));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleSortCol = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Error state ──────────────────────────────────────────────────────────
  if (result.error) {
    return (
      <View style={styles.wrapPad}>
        <View style={[styles.statusCard, { backgroundColor: colors.destructiveSubtle, borderColor: colors.destructive + '50' }]}>
          <View style={[styles.statusIcon, { backgroundColor: colors.destructive + '20' }]}>
            <Ionicons name="close-circle" size={20} color={colors.destructive} />
          </View>
          <View style={styles.statusBody}>
            <Text style={[styles.statusTitle, { color: colors.destructive }]}>
              {result.errorTitle ?? 'Query Error'}
            </Text>
            <Text style={[styles.statusMsg, { color: colors.destructive, fontFamily: MONO_FONT, fontSize: 12, opacity: 0.9 }]}>
              {result.error}
            </Text>
            {result.errorHint && (
              <View style={[styles.hintRow, { backgroundColor: colors.warningSubtle, borderColor: colors.warning + '40' }]}>
                <Ionicons name="bulb-outline" size={13} color={colors.warning} />
                <Text style={[styles.hintText, { color: colors.warning }]}>
                  {result.errorHint}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── DML / DDL success state ──────────────────────────────────────────────
  const hasRows = result.rows.length > 0 || result.columns.length > 0;
  if (!hasRows && (
    result.type === 'dml' || result.type === 'ddl' ||
    result.type === 'pragma' || result.type === 'transaction' ||
    result.type === 'maintenance'
  )) {
    const isTx = result.type === 'transaction';
    const isMaint = result.type === 'maintenance';
    const titleMap: Record<string, string> = {
      transaction: 'Transaction Updated',
      maintenance: 'Maintenance Complete',
      ddl: 'Schema Updated',
      pragma: 'Pragma Applied',
    };
    const title = titleMap[result.type] ?? 'Query Successful';

    return (
      <View style={styles.wrapPad}>
        <View style={[styles.statusCard, { backgroundColor: colors.accentSubtle, borderColor: colors.accent + '50' }]}>
          <View style={[styles.statusIcon, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          </View>
          <View style={styles.statusBody}>
            <Text style={[styles.statusTitle, { color: colors.accent }]}>{title}</Text>
            <Text style={[styles.statusMsg, { color: colors.mutedForeground }]}>
              {result.rowsAffected} row{result.rowsAffected !== 1 ? 's' : ''} affected
              {result.insertId ? ` · Last ID: ${result.insertId}` : ''}
              {result.statementCount && result.statementCount > 1 ? ` · ${result.statementCount} stmts` : ''}
              {' · '}{formatDuration(result.executionTime)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Empty rows ───────────────────────────────────────────────────────────
  if (result.rows.length === 0) {
    return (
      <View style={[styles.emptyResult]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
          <MaterialIcons name="table-rows" size={28} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No rows returned</Text>
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
          {result.columns.length > 0
            ? `${result.columns.length} col${result.columns.length !== 1 ? 's' : ''} · 0 rows · ${formatDuration(result.executionTime)}`
            : formatDuration(result.executionTime)}
        </Text>
      </View>
    );
  }

  // ── Sorted rows ──────────────────────────────────────────────────────────
  const displayRows = sortCol
    ? [...result.rows].sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : result.rows;

  const colWidths = result.columns.reduce<Record<string, number>>((acc, col) => {
    acc[col] = getColWidth(col, result.rows);
    return acc;
  }, {});

  const totalWidth = ROW_NUM_WIDTH + result.columns.reduce((s, c) => s + colWidths[c], 0);

  const renderRow = useCallback(
    ({ item, index }: { item: Record<string, unknown>; index: number }) => (
      <View
        style={[
          styles.dataRow,
          {
            backgroundColor: index % 2 === 0 ? 'transparent' : colors.muted + '50',
            borderBottomColor: colors.border,
            width: totalWidth,
          },
        ]}
      >
        <View style={[styles.rowNum, { borderRightColor: colors.border }]}>
          <Text style={[styles.rowNumText, { color: colors.mutedForeground }]}>{index + 1}</Text>
        </View>
        {result.columns.map(col => {
          const val = item[col];
          const isNull = val === null || val === undefined;
          const isSel = selectedCell?.row === index && selectedCell?.col === col;
          return (
            <Pressable
              key={col}
              onPress={() => {
                setSelectedCell(isSel ? null : { row: index, col });
                if (!isNull) handleCopyCell(val);
              }}
              style={[
                styles.dataCell,
                {
                  width: colWidths[col],
                  borderRightColor: colors.border,
                  backgroundColor: isSel ? colors.primary + '18' : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.dataCellText,
                  {
                    color: isNull ? colors.mutedForeground + '80' : colors.foreground,
                    fontStyle: isNull ? 'italic' : 'normal',
                    fontFamily: MONO_FONT,
                  },
                ]}
                numberOfLines={2}
              >
                {isNull ? 'NULL' : String(val)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [result.columns, colWidths, colors, totalWidth, selectedCell]
  );

  return (
    <View style={styles.container}>
      {/* Truncation warning */}
      {result.truncated && (
        <View style={[styles.truncBanner, { backgroundColor: colors.warningSubtle, borderBottomColor: colors.warning + '50' }]}>
          <Ionicons name="warning-outline" size={14} color={colors.warning} />
          <Text style={[styles.truncText, { color: colors.warning }]}>
            Showing {result.rows.length} rows (truncated). Add LIMIT or raise Row Limit in Settings.
          </Text>
        </View>
      )}

      {/* Meta bar */}
      <View style={[styles.metaBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.metaBadge, { backgroundColor: colors.primary + '14' }]}>
          <MaterialIcons name="table-chart" size={12} color={colors.primary} />
          <Text style={[styles.metaBadgeText, { color: colors.primary }]}>
            {result.rows.length}{result.truncated ? '+' : ''} rows
          </Text>
        </View>
        <View style={[styles.metaBadge, { backgroundColor: colors.muted }]}>
          <Ionicons name="grid-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaBadgeText, { color: colors.mutedForeground }]}>
            {result.columns.length} cols
          </Text>
        </View>
        <View style={[styles.metaBadge, { backgroundColor: colors.muted }]}>
          <Ionicons name="flash-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaBadgeText, { color: colors.mutedForeground }]}>
            {formatDuration(result.executionTime)}
          </Text>
        </View>
        <View style={styles.metaSpacer} />
        {sortCol && (
          <Pressable
            onPress={() => { setSortCol(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.clearSortBtn, { backgroundColor: colors.muted }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={11} color={colors.mutedForeground} />
            <Text style={[styles.clearSortText, { color: colors.mutedForeground }]}>Sort</Text>
          </Pressable>
        )}
        {onExport && (
          <Pressable onPress={onExport} style={[styles.exportBtn, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]} hitSlop={8}>
            <Ionicons name="share-outline" size={13} color={colors.primary} />
            <Text style={[styles.exportText, { color: colors.primary }]}>Export</Text>
          </Pressable>
        )}
      </View>

      {/* Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
        <View style={{ width: totalWidth }}>
          {/* Header row */}
          <View style={[styles.headerRow, { backgroundColor: colors.elevated, borderBottomColor: colors.border, width: totalWidth }]}>
            <View style={[styles.rowNum, { borderRightColor: colors.border }]}>
              <Text style={[styles.rowNumText, { color: colors.mutedForeground, fontSize: 9 }]}>#</Text>
            </View>
            {result.columns.map(col => {
              const isSorted = sortCol === col;
              return (
                <Pressable
                  key={col}
                  onPress={() => handleSortCol(col)}
                  style={[
                    styles.headerCell,
                    {
                      width: colWidths[col],
                      borderRightColor: colors.border,
                      backgroundColor: isSorted ? colors.primary + '12' : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.headerText, { color: isSorted ? colors.primary : colors.foreground, fontFamily: MONO_FONT }]}>
                    {col}
                  </Text>
                  {isSorted && (
                    <Ionicons
                      name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={10}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Data rows */}
          <FlatList
            data={displayRows}
            renderItem={renderRow}
            keyExtractor={(_, idx) => String(idx)}
            scrollEnabled={false}
            removeClippedSubviews
            maxToRenderPerBatch={20}
            initialNumToRender={30}
          />
        </View>
      </ScrollView>

      {/* Copy hint */}
      {selectedCell && (
        <View style={[styles.copyHint, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={13} color={colors.accent} />
          <Text style={[styles.copyHintText, { color: colors.mutedForeground }]}>
            Copied · tap another cell to copy
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrapPad: { padding: 14 },

  // Status cards
  statusCard: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBody: { flex: 1, gap: 5 },
  statusTitle: { fontSize: 14, fontWeight: '700' },
  statusMsg: { fontSize: 13, lineHeight: 19 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // Empty
  emptyResult: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  emptyDesc: { fontSize: 13 },

  // Banners
  truncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  truncText: { flex: 1, fontSize: 12, lineHeight: 16 },

  // Meta bar
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaBadgeText: { fontSize: 11, fontWeight: '600' },
  metaSpacer: { flex: 1 },
  clearSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearSortText: { fontSize: 11 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  exportText: { fontSize: 12, fontWeight: '700' },

  // Grid
  gridScroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  headerText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowNum: {
    width: ROW_NUM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  rowNumText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dataCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  dataCellText: { fontSize: 12, lineHeight: 18 },

  // Copy hint
  copyHint: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  copyHintText: { fontSize: 12 },
});
