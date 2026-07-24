/**
 * Task 2.3 — Query Results Export Modal
 * Shows format options (CSV / JSON / SQL) and triggers share sheet.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { QueryResult } from '@/utils/sqliteManager';
import { shareTextFile } from '@/utils/exportUtils';

interface ExportModalProps {
  visible: boolean;
  result: QueryResult;
  tableName?: string; // optional — used to name the file
  onClose: () => void;
}

type Format = 'csv' | 'json' | 'sql';

const FORMATS: { key: Format; label: string; icon: string; ext: string }[] = [
  { key: 'csv',  label: 'CSV',  icon: 'table-chart', ext: 'csv' },
  { key: 'json', label: 'JSON', icon: 'data-object',  ext: 'json' },
  { key: 'sql',  label: 'SQL INSERT statements', icon: 'code', ext: 'sql' },
];

function resultsToCSV(result: QueryResult): string {
  const csvEscape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = result.columns.join(',');
  const rows = result.rows.map(r => result.columns.map(c => csvEscape(r[c])).join(','));
  return [header, ...rows].join('\n');
}

function resultsToJSON(result: QueryResult): string {
  return JSON.stringify(result.rows, null, 2);
}

function resultsToSQL(result: QueryResult, tableName: string): string {
  const sqlVal = (v: unknown) =>
    v === null || v === undefined
      ? 'NULL'
      : typeof v === 'number'
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

  const cols = result.columns.map(c => `"${c}"`).join(', ');
  const lines = result.rows.map(r => {
    const vals = result.columns.map(c => sqlVal(r[c])).join(', ');
    return `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`;
  });
  return lines.join('\n');
}

export function ExportModal({ visible, result, tableName = 'export', onClose }: ExportModalProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  const handleExport = async (fmt: Format) => {
    setLoading(true);
    try {
      let content = '';
      let filename = '';
      if (fmt === 'csv') {
        content = resultsToCSV(result);
        filename = `${tableName}.csv`;
      } else if (fmt === 'json') {
        content = resultsToJSON(result);
        filename = `${tableName}.json`;
      } else {
        content = resultsToSQL(result, tableName);
        filename = `${tableName}.sql`;
      }
      await shareTextFile(content, filename);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.foreground }]}>Export Results</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {result.rows.length} rows · {result.columns.length} columns
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            FORMATS.map(fmt => (
              <Pressable
                key={fmt.key}
                onPress={() => handleExport(fmt.key)}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: pressed ? colors.muted : colors.background, borderColor: colors.border },
                ]}
              >
                <MaterialIcons name={fmt.icon as any} size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>{fmt.label}</Text>
                  <Text style={[styles.optionExt, { color: colors.mutedForeground }]}>.{fmt.ext} file</Text>
                </View>
                <MaterialIcons name="ios-share" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))
          )}

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 16 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionExt: { fontSize: 12, marginTop: 2 },
  cancelBtn: { marginTop: 6, alignItems: 'center', padding: 12 },
  cancelText: { fontSize: 15, fontWeight: '500' },
});
