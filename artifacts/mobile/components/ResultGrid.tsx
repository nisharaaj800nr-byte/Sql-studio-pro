import React, { useCallback } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { MaterialIcons } from '@expo/vector-icons';
import { QueryResult } from '@/utils/sqliteManager';
import { formatDuration } from '@/utils/formatters';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const COL_MIN_WIDTH = 100;
const COL_MAX_WIDTH = 280;
const ROW_NUM_WIDTH = 42;

interface ResultGridProps {
  result: QueryResult;
  onExport?: () => void;
}

function getColWidth(colName: string, rows: Record<string, unknown>[]): number {
  const headerLen = colName.length * 8 + 24;
  const maxDataLen = Math.min(
    Math.max(...rows.slice(0, 50).map(r => String(r[colName] ?? '').length * 7 + 20)),
    COL_MAX_WIDTH
  );
  return Math.max(COL_MIN_WIDTH, headerLen, maxDataLen);
}

export function ResultGrid({ result, onExport }: ResultGridProps) {
  const colors = useColors();

  if (result.error) {
    return (
      <View style={[styles.statusContainer, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}>
        <MaterialIcons name="error-outline" size={22} color={colors.destructive} />
        <View style={styles.statusContent}>
          <Text style={[styles.statusTitle, { color: colors.destructive }]}>
            {result.errorTitle ?? 'Query Error'}
          </Text>
          <Text style={[styles.statusMsg, { color: colors.destructive, opacity: 0.85, fontFamily: MONO_FONT, fontSize: 12 }]}>
            {result.error}
          </Text>
          {result.errorHint && (
            <Text style={[styles.statusHint, { color: colors.mutedForeground }]}>
              Hint: {result.errorHint}
            </Text>
          )}
        </View>
      </View>
    );
  }

  const hasRows = result.rows.length > 0 || result.columns.length > 0;

  if (!hasRows && (
    result.type === 'dml' ||
    result.type === 'ddl' ||
    result.type === 'pragma' ||
    result.type === 'transaction' ||
    result.type === 'maintenance'
  )) {
    return (
      <View style={[styles.statusContainer, { backgroundColor: colors.accent + '15', borderColor: colors.accent }]}>
        <MaterialIcons name="check-circle-outline" size={22} color={colors.accent} />
        <View style={styles.statusContent}>
          <Text style={[styles.statusTitle, { color: colors.accent }]}>
            {result.type === 'transaction' ? 'Transaction Updated' : result.type === 'maintenance' ? 'Maintenance Complete' : 'Query Successful'}
          </Text>
          <Text style={[styles.statusMsg, { color: colors.mutedForeground }]}>
            {result.rowsAffected} row{result.rowsAffected !== 1 ? 's' : ''} affected
            {result.insertId ? ` · Last insert ID: ${result.insertId}` : ''}
            {result.statementCount && result.statementCount > 1 ? ` · ${result.statementCount} statements` : ''}
            {' · '}{formatDuration(result.executionTime)}
          </Text>
        </View>
      </View>
    );
  }

  if (result.rows.length === 0) {
    return (
      <View style={[styles.emptyResult, { borderColor: colors.border }]}>
        <MaterialIcons name="table-rows" size={36} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No rows returned</Text>
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
          {result.columns.length > 0
            ? `${result.columns.length} column${result.columns.length !== 1 ? 's' : ''} · 0 rows · ${formatDuration(result.executionTime)}`
            : formatDuration(result.executionTime)}
        </Text>
      </View>
    );
  }

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
            backgroundColor: index % 2 === 0 ? colors.background : colors.muted + '55',
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
          return (
            <View
              key={col}
              style={[styles.dataCell, { width: colWidths[col], borderRightColor: colors.border }]}
            >
              <Text
                style={[
                  styles.dataCellText,
                  {
                    color: isNull ? colors.mutedForeground : colors.foreground,
                    fontStyle: isNull ? 'italic' : 'normal',
                    fontFamily: MONO_FONT,
                  },
                ]}
                numberOfLines={2}
              >
                {isNull ? 'NULL' : String(val)}
              </Text>
            </View>
          );
        })}
      </View>
    ),
    [result.columns, colWidths, colors, totalWidth]
  );

  return (
    <View style={styles.container}>
      {/* Truncation warning banner */}
      {result.truncated && (
        <View style={[styles.truncBanner, { backgroundColor: colors.sqlString + '22', borderBottomColor: colors.sqlString + '66' }]}>
          <MaterialIcons name="warning-amber" size={14} color={colors.sqlString} />
          <Text style={[styles.truncText, { color: colors.sqlString }]}>
            Output truncated — showing {result.rows.length} of more rows. Add a LIMIT clause or raise the Row Limit in Settings.
          </Text>
        </View>
      )}

      {/* Meta bar */}
      <View style={[styles.metaBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <MaterialIcons name="table-chart" size={14} color={colors.mutedForeground} />
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {result.rows.length}{result.truncated ? '+' : ''} row{result.rows.length !== 1 ? 's' : ''} · {result.columns.length} col
          {result.columns.length !== 1 ? 's' : ''} · {formatDuration(result.executionTime)}
        </Text>
        {onExport && (
          <Pressable onPress={onExport} style={styles.exportBtn} hitSlop={8}>
            <MaterialIcons name="ios-share" size={14} color={colors.primary} />
            <Text style={[styles.exportText, { color: colors.primary }]}>Export</Text>
          </Pressable>
        )}
      </View>

      {/* Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
        <View style={{ width: totalWidth }}>
          {/* Header row */}
          <View
            style={[
              styles.headerRow,
              { backgroundColor: colors.card, borderBottomColor: colors.border, width: totalWidth },
            ]}
          >
            <View style={[styles.rowNum, { borderRightColor: colors.border }]}>
              <MaterialIcons name="tag" size={12} color={colors.mutedForeground} />
            </View>
            {result.columns.map(col => (
              <View
                key={col}
                style={[styles.headerCell, { width: colWidths[col], borderRightColor: colors.border }]}
              >
                <Text style={[styles.headerText, { color: colors.foreground, fontFamily: MONO_FONT }]}>
                  {col}
                </Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          <FlatList
            data={result.rows}
            renderItem={renderRow}
            keyExtractor={(_, idx) => String(idx)}
            scrollEnabled={false}
            removeClippedSubviews
            maxToRenderPerBatch={20}
            initialNumToRender={30}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  statusContent: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 14, fontWeight: '700' },
  statusMsg: { fontSize: 13, lineHeight: 20 },
  statusHint: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  emptyResult: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptyDesc: { fontSize: 13 },
  truncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  truncText: { flex: 1, fontSize: 11, lineHeight: 16 },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  metaText: { flex: 1, fontSize: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportText: { fontSize: 12, fontWeight: '600' },
  gridScroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  headerCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRightWidth: 0.5,
  },
  headerText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  rowNum: {
    width: ROW_NUM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    paddingVertical: 8,
  },
  rowNumText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dataCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRightWidth: 0.5,
  },
  dataCellText: { fontSize: 13, lineHeight: 18 },
});
