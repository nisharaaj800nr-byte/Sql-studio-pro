/**
 * Task 2.10 — CSV / SQL File Import Modal
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useColors } from '@/hooks/useColors';
import { importCSVToTable, importSQLFile } from '@/utils/sqliteManager';

interface ImportModalProps {
  visible: boolean;
  dbId: string;
  tables: string[];
  onDone: () => void;
  onCancel: () => void;
}

export function ImportModal({ visible, dbId, tables, onDone, onCancel }: ImportModalProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [targetTable, setTargetTable] = useState('');
  const [mode, setMode] = useState<'csv' | 'sql'>('csv');

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'application/sql', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      const filename = asset.name ?? '';
      const isSQL = filename.endsWith('.sql');
      setLoading(true);

      const content = await (FileSystem as any).readAsStringAsync(asset.uri, {
        encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8',
      });

      if (isSQL) {
        const r = await importSQLFile(dbId, content);
        if (r.ok) {
          Alert.alert('Import Successful', 'SQL file executed successfully.');
          onDone();
        } else {
          Alert.alert('Import Error', r.error ?? 'Unknown error');
        }
      } else {
        // CSV import
        if (!targetTable.trim()) {
          Alert.alert('Select Table', 'Please enter the target table name first.');
          setLoading(false);
          return;
        }
        const r = await importCSVToTable(dbId, targetTable.trim(), content);
        Alert.alert(
          r.errors.length > 0 ? 'Partial Import' : 'Import Successful',
          `${r.imported} rows imported.${r.errors.length > 0 ? `\n${r.errors.slice(0, 3).join('\n')}` : ''}`
        );
        onDone();
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.foreground }]}>Import Data</Text>

          {/* Mode selector */}
          <View style={[styles.modeRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {(['csv', 'sql'] as const).map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeBtn, mode === m && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modeBtnText, { color: mode === m ? colors.primaryForeground : colors.mutedForeground }]}>
                  {m.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'csv' && (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>TARGET TABLE</Text>
              <TextInput
                value={targetTable}
                onChangeText={setTargetTable}
                placeholder={tables[0] ?? 'table_name'}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {tables.length > 0 && (
                <View style={styles.tableChips}>
                  {tables.map(t => (
                    <Pressable
                      key={t}
                      onPress={() => setTargetTable(t)}
                      style={[styles.tableChip, { backgroundColor: targetTable === t ? colors.primary : colors.muted }]}
                    >
                      <Text style={{ color: targetTable === t ? colors.primaryForeground : colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {mode === 'csv'
              ? 'Select a CSV file. First row must be column headers.'
              : 'Select a .sql file. All statements will be executed.'}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <Pressable
              onPress={pickFile}
              style={[styles.pickBtn, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="upload-file" size={20} color={colors.primaryForeground} />
              <Text style={[styles.pickBtnText, { color: colors.primaryForeground }]}>
                Choose {mode.toUpperCase()} File
              </Text>
            </Pressable>
          )}

          <Pressable onPress={onCancel} style={styles.cancelBtn}>
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
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modeRow: {
    flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginBottom: 16,
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  modeBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  tableChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tableChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  hint: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, marginBottom: 10,
  },
  pickBtnText: { fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { fontSize: 15, fontWeight: '500' },
});
