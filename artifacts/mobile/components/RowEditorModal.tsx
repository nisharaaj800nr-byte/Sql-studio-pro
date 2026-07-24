/**
 * Task 2.8 — Row Editor Modal
 * Add a new row or edit an existing row in a table.
 */
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ColumnInfo } from '@/utils/sqliteManager';

interface RowEditorModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  columns: ColumnInfo[];
  initialValues?: Record<string, unknown>;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function RowEditorModal({
  visible,
  mode,
  columns,
  initialValues = {},
  onConfirm,
  onCancel,
}: RowEditorModalProps) {
  const colors = useColors();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      const init: Record<string, string> = {};
      for (const col of columns) {
        const iv = initialValues[col.name];
        init[col.name] = iv === null || iv === undefined ? '' : String(iv);
      }
      setValues(init);
    }
  }, [visible, columns, initialValues]);

  const editableCols = mode === 'edit'
    ? columns.filter(c => c.pk === 0)
    : columns.filter(c => c.pk === 0 || c.dflt_value === null);

  const handleConfirm = () => {
    onConfirm(values);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {mode === 'add' ? 'Add Row' : 'Edit Row'}
            </Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {columns.map(col => {
              const isEditable = editableCols.some(c => c.name === col.name);
              const isPK = col.pk > 0;
              return (
                <View key={col.name} style={styles.field}>
                  <View style={styles.fieldLabel}>
                    <Text style={[styles.colName, { color: colors.foreground }]}>{col.name}</Text>
                    <Text style={[styles.colMeta, { color: colors.mutedForeground }]}>
                      {col.type || 'ANY'}
                      {isPK ? ' · PK' : ''}
                      {col.notnull && !isPK ? ' · NOT NULL' : ''}
                    </Text>
                  </View>
                  {isEditable ? (
                    <TextInput
                      value={values[col.name] ?? ''}
                      onChangeText={v => setValues(prev => ({ ...prev, [col.name]: v }))}
                      style={[
                        styles.input,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                      ]}
                      placeholder={col.dflt_value !== null ? `default: ${col.dflt_value}` : 'NULL'}
                      placeholderTextColor={colors.mutedForeground}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  ) : (
                    <View style={[styles.readOnly, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>
                        {isPK && mode === 'add' ? 'Auto-generated' : String(initialValues[col.name] ?? 'NULL')}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, { borderColor: colors.border, borderWidth: 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={[styles.btn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                {mode === 'add' ? 'Add Row' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  colName: { fontSize: 14, fontWeight: '600' },
  colMeta: { fontSize: 11 },
  input: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14,
  },
  readOnly: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  readOnlyText: { fontSize: 14, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1,
  },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
});
