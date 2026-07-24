/**
 * Task 2.9 — Create Table UI
 * Full column-definition form: name, type, NOT NULL, PRIMARY KEY, DEFAULT.
 */
import React, { useState } from 'react';
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

export interface ColumnDef {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  defaultValue: string;
}

interface CreateTableModalProps {
  visible: boolean;
  onConfirm: (tableName: string, columns: ColumnDef[]) => void;
  onCancel: () => void;
}

const TYPES = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'];

const defaultCol = (): ColumnDef => ({
  name: '',
  type: 'TEXT',
  notNull: false,
  primaryKey: false,
  defaultValue: '',
});

export function CreateTableModal({ visible, onConfirm, onCancel }: CreateTableModalProps) {
  const colors = useColors();
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: 'id', type: 'INTEGER', notNull: false, primaryKey: true, defaultValue: '' },
    { name: 'name', type: 'TEXT', notNull: true, primaryKey: false, defaultValue: '' },
  ]);

  const reset = () => {
    setTableName('');
    setColumns([
      { name: 'id', type: 'INTEGER', notNull: false, primaryKey: true, defaultValue: '' },
      { name: 'name', type: 'TEXT', notNull: true, primaryKey: false, defaultValue: '' },
    ]);
  };

  const addColumn = () => setColumns(prev => [...prev, defaultCol()]);

  const updateCol = (i: number, patch: Partial<ColumnDef>) => {
    setColumns(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  };

  const removeCol = (i: number) => {
    if (columns.length <= 1) return;
    setColumns(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleConfirm = () => {
    if (!tableName.trim() || columns.some(c => !c.name.trim())) return;
    onConfirm(tableName.trim(), columns);
    reset();
  };

  const handleCancel = () => { reset(); onCancel(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Create Table</Text>
            <Pressable onPress={handleCancel} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Table name */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TABLE NAME</Text>
            <TextInput
              value={tableName}
              onChangeText={setTableName}
              placeholder="e.g. users, products"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>COLUMNS</Text>

            {columns.map((col, i) => (
              <View key={i} style={[styles.colCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.colRow}>
                  <TextInput
                    value={col.name}
                    onChangeText={v => updateCol(i, { name: v })}
                    placeholder="column name"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.colNameInput, { color: colors.foreground, borderColor: colors.border }]}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                    {TYPES.map(t => (
                      <Pressable
                        key={t}
                        onPress={() => updateCol(i, { type: t })}
                        style={[
                          styles.typeChip,
                          { backgroundColor: col.type === t ? colors.primary : colors.muted, borderColor: colors.border },
                        ]}
                      >
                        <Text style={{ color: col.type === t ? colors.primaryForeground : colors.mutedForeground, fontSize: 11, fontWeight: '700' }}>
                          {t}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.flagRow}>
                  {[
                    { key: 'primaryKey', label: 'PK' },
                    { key: 'notNull', label: 'NOT NULL' },
                  ].map(flag => (
                    <Pressable
                      key={flag.key}
                      onPress={() => updateCol(i, { [flag.key]: !col[flag.key as keyof ColumnDef] } as any)}
                      style={[
                        styles.flagChip,
                        { backgroundColor: col[flag.key as keyof ColumnDef] ? colors.primary + '22' : colors.muted, borderColor: col[flag.key as keyof ColumnDef] ? colors.primary : colors.border },
                      ]}
                    >
                      <Text style={{ color: col[flag.key as keyof ColumnDef] ? colors.primary : colors.mutedForeground, fontSize: 11, fontWeight: '700' }}>
                        {flag.label}
                      </Text>
                    </Pressable>
                  ))}

                  <TextInput
                    value={col.defaultValue}
                    onChangeText={v => updateCol(i, { defaultValue: v })}
                    placeholder="DEFAULT"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.defaultInput, { color: colors.foreground, borderColor: colors.border }]}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />

                  {columns.length > 1 && (
                    <Pressable onPress={() => removeCol(i)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                      <MaterialIcons name="remove-circle-outline" size={20} color={colors.destructive} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            <Pressable onPress={addColumn} style={[styles.addColBtn, { borderColor: colors.primary }]}>
              <MaterialIcons name="add" size={18} color={colors.primary} />
              <Text style={[styles.addColText, { color: colors.primary }]}>Add Column</Text>
            </Pressable>
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable onPress={handleCancel} style={[styles.btn, { borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!tableName.trim()}
              style={[styles.btn, { backgroundColor: tableName.trim() ? colors.primary : colors.muted }]}
            >
              <Text style={[styles.btnText, { color: tableName.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                Create Table
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '95%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 4 },
  colCard: { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10, gap: 8 },
  colRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colNameInput: {
    flex: 1, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8,
    paddingVertical: 7, fontSize: 13,
  },
  typeScroll: { flexGrow: 0, maxWidth: '55%' },
  typeChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
    marginRight: 4,
  },
  flagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  flagChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  defaultInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 11, width: 90,
  },
  addColBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 12, marginTop: 4, borderStyle: 'dashed',
  },
  addColText: { fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
});
