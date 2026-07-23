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
import { getTableData, getColumns, getTableRowCount, exportTableToCSV, exportTableToJSON, exportDatabaseToSQL, ColumnInfo } from '@/utils/sqliteManager';
import { ResultGrid } from '@/components/ResultGrid';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { shareTextFile } from '@/utils/exportUtils';

type TabType = 'data' | 'structure';

export default function TableViewerScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const decodedName = name ? decodeURIComponent(name) : '';
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setCurrentSql } = useEditor();
  const { setActiveDbId } = useDatabases();
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [colInfo, setColInfo] = useState<ColumnInfo[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const loadData = useCallback(async () => {
    if (!id || !decodedName) return;
    setIsLoading(true);
    try {
      const [data, info, count] = await Promise.all([
        getTableData(id, decodedName, PAGE_SIZE, page * PAGE_SIZE),
        getColumns(id, decodedName),
        getTableRowCount(id, decodedName),
      ]);
      setColumns(data.columns);
      setRows(data.rows);
      setColInfo(info);
      setRowCount(count);
    } catch (e) {
      Alert.alert('Error', `Could not load table data: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [id, decodedName, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQueryTable = () => {
    if (id) {
      setActiveDbId(id);
      setCurrentSql(`SELECT * FROM "${decodedName}" LIMIT 100;`);
      router.push('/(tabs)/editor');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: decodedName,
          headerRight: () => (
            <Pressable onPress={handleQueryTable} hitSlop={8} style={{ marginRight: Platform.OS === 'ios' ? 0 : 8 }}>
              <MaterialIcons name="code" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['data', 'structure'] as TabType[]).map(tab => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomWidth: 2, borderBottomColor: colors.primary },
            ]}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === 'data' ? `Data (${rowCount.toLocaleString()})` : 'Structure'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'data' ? (
        <View style={{ flex: 1 }}>
          <ResultGrid
            result={{
              columns,
              rows,
              rowsAffected: 0,
              executionTime: 0,
              type: 'select',
            }}
          />
          {/* Pagination */}
          {rowCount > PAGE_SIZE && (
            <View style={[styles.pagination, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={({ pressed }) => [
                  styles.pageBtn,
                  { backgroundColor: colors.muted, opacity: page === 0 ? 0.4 : pressed ? 0.7 : 1 },
                ]}
              >
                <MaterialIcons name="chevron-left" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.pageText, { color: colors.mutedForeground }]}>
                Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowCount)} of {rowCount.toLocaleString()}
              </Text>
              <Pressable
                onPress={() => setPage(p => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= rowCount}
                style={({ pressed }) => [
                  styles.pageBtn,
                  {
                    backgroundColor: colors.muted,
                    opacity: (page + 1) * PAGE_SIZE >= rowCount ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
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
              <Text
                key={h}
                style={[
                  styles.structHeaderCell,
                  { color: colors.mutedForeground, flex: i === 1 ? 2 : 1 },
                ]}
              >
                {h}
              </Text>
            ))}
          </View>
          {colInfo.map((col, idx) => (
            <View
              key={col.cid}
              style={[
                styles.structRow,
                {
                  backgroundColor: idx % 2 === 0 ? colors.background : colors.card,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.structCell, { color: colors.mutedForeground, flex: 1 }]}>{col.cid}</Text>
              <Text style={[styles.structCell, { color: colors.foreground, fontWeight: '600', flex: 2 }]}>{col.name}</Text>
              <Text style={[styles.structCell, { color: colors.primary, flex: 1 }]}>{col.type || 'ANY'}</Text>
              <Text style={[styles.structCell, { color: col.notnull ? colors.destructive : colors.mutedForeground, flex: 1 }]}>
                {col.notnull ? 'YES' : 'NO'}
              </Text>
              <Text style={[styles.structCell, { color: colors.mutedForeground, flex: 1 }]}>
                {col.dflt_value ?? '—'}
              </Text>
              <Text style={[styles.structCell, { color: col.pk ? colors.accent : colors.mutedForeground, flex: 1, fontWeight: col.pk ? '700' : '400' }]}>
                {col.pk ? 'YES' : '—'}
              </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  pageBtn: { borderRadius: 8, padding: 6 },
  pageText: { fontSize: 13 },
  structHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  structHeaderCell: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  structRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  structCell: { fontSize: 13 },
  noStructure: { padding: 32, alignItems: 'center' },
  noStructureText: { fontSize: 14 },
});
