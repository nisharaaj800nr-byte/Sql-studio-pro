import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { formatSQL } from '@/utils/sqlHighlight';
import { getSQLSuggestions, getStaticSQLDiagnostics, type SQLDiagnostic } from '@/utils/sqlDiagnostics';
import { getSQLCompletionItems } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const SQL_SNIPPETS = [
  { label: 'SELECT *', sql: 'SELECT * FROM ' },
  { label: 'WHERE', sql: ' WHERE ' },
  { label: 'AND', sql: ' AND ' },
  { label: 'OR', sql: ' OR ' },
  { label: 'ORDER BY', sql: '\nORDER BY  ASC' },
  { label: 'LIMIT', sql: '\nLIMIT 100' },
  { label: 'JOIN', sql: '\nINNER JOIN  ON .id = .id' },
  { label: 'GROUP BY', sql: '\nGROUP BY ' },
  { label: 'HAVING', sql: '\nHAVING COUNT(*) > 1' },
  { label: 'INSERT', sql: 'INSERT INTO  (col1, col2)\nVALUES (val1, val2)' },
  { label: 'UPDATE', sql: 'UPDATE \nSET col = val\nWHERE id = 1' },
  { label: 'DELETE', sql: 'DELETE FROM \nWHERE id = 1' },
  { label: 'CREATE TABLE', sql: 'CREATE TABLE  (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n)' },
  { label: 'ALTER', sql: 'ALTER TABLE  ADD COLUMN  TEXT' },
  { label: 'DROP', sql: 'DROP TABLE IF EXISTS ' },
  { label: 'PRAGMA', sql: 'PRAGMA table_info()' },
  { label: 'EXPLAIN', sql: 'EXPLAIN QUERY PLAN\n' },
  { label: 'COUNT', sql: 'SELECT COUNT(*) FROM ' },
  { label: 'DISTINCT', sql: 'SELECT DISTINCT  FROM ' },
  { label: 'NULL', sql: ' IS NULL' },
];

interface SQLEditorProps {
  value: string;
  onChange: (text: string) => void;
  onRun: () => void;
  isExecuting?: boolean;
  databaseName?: string;
  databaseId?: string | null;
  databaseColor?: string;
}

export function SQLEditor({
  value,
  onChange,
  onRun,
  isExecuting = false,
  databaseName,
  databaseId,
  databaseColor,
}: SQLEditorProps) {
  const colors = useColors();
  const { settings } = useSettings();
  const inputRef = useRef<TextInput>(null);
  const lineCount = value.split('\n').length;
  const fontSize = settings.fontSize;
  const lineHeight = Math.round(fontSize * 1.6);
  const diagnostics = getStaticSQLDiagnostics(value);
  const currentWord = value.match(/[A-Za-z_][A-Za-z0-9_]*$/)?.[0] ?? '';
  const [schemaSuggestions, setSchemaSuggestions] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!settings.autoComplete || !databaseId) {
      setSchemaSuggestions([]);
      return;
    }
    getSQLCompletionItems(databaseId)
      .then(items => {
        if (cancelled) return;
        setSchemaSuggestions([
          ...items.tables,
          ...items.views,
          ...items.columns,
          ...items.indexes,
          ...items.triggers,
        ]);
      })
      .catch(() => {
        if (!cancelled) setSchemaSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [databaseId, settings.autoComplete]);
  const suggestions = settings.autoComplete
    ? Array.from(new Set([
      ...getSQLSuggestions(currentWord),
      ...schemaSuggestions.filter(item => item.toUpperCase().startsWith(currentWord.toUpperCase())),
    ])).slice(0, 10)
    : [];

  const handleFormat = () => {
    const formatted = formatSQL(value);
    onChange(formatted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRun = () => {
    if (isExecuting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRun();
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const insertSnippet = (snippet: string) => {
    onChange(value + snippet);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {databaseName ? (
          <View style={[styles.dbPill, { backgroundColor: (databaseColor ?? colors.primary) + '22' }]}>
            <MaterialCommunityIcons name="database" size={12} color={databaseColor ?? colors.primary} />
            <Text
              style={[styles.dbPillText, { color: databaseColor ?? colors.primary }]}
              numberOfLines={1}
            >
              {databaseName}
            </Text>
          </View>
        ) : (
          <View style={styles.flex1} />
        )}

        <View style={styles.toolbarRight}>
          <Pressable
            onPress={handleFormat}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="code-braces" size={18} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            onPress={handleClear}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <MaterialIcons name="clear-all" size={18} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            onPress={handleRun}
            style={[
              styles.runButton,
              {
                backgroundColor: isExecuting ? colors.muted : colors.primary,
              },
            ]}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="play" size={14} color={colors.primaryForeground} />
            )}
            <Text style={[styles.runText, { color: isExecuting ? colors.mutedForeground : colors.primaryForeground }]}>
              {isExecuting ? 'Running' : 'Run'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Editor: line numbers + TextInput */}
      <View style={[styles.editorWrapper, { backgroundColor: colors.editorBg }]}>
        <ScrollView style={styles.editorScroll} keyboardDismissMode="none">
          <View style={styles.editorInner}>
            {/* Line numbers */}
            <View style={[styles.lineNumbers, { backgroundColor: colors.background, borderRightColor: colors.border }]}>
              {Array.from({ length: lineCount }, (_, i) => (
                <Text key={i} style={[styles.lineNum, { color: colors.editorLineNumber, lineHeight, fontSize }]}>
                  {i + 1}
                </Text>
              ))}
            </View>

            {/* Input */}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChange}
              style={[styles.codeInput, { color: colors.editorText, fontSize, lineHeight }]}
              multiline
              scrollEnabled={false}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              keyboardType="ascii-capable"
              selectionColor={colors.editorCaret}
              placeholder="-- Write your SQL here..."
              placeholderTextColor={colors.editorLineNumber}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>

      {(diagnostics.length > 0 || suggestions.length > 0) && (
        <View style={[styles.assistPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {diagnostics.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.diagnosticContent}
              keyboardShouldPersistTaps="always"
            >
              {diagnostics.map((item, index) => (
                <DiagnosticChip key={`${item.code}-${index}`} item={item} colors={colors} />
              ))}
            </ScrollView>
          )}
          {suggestions.length > 0 && currentWord.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionContent}
              keyboardShouldPersistTaps="always"
            >
              <Text style={[styles.assistLabel, { color: colors.mutedForeground }]}>Suggest</Text>
              {suggestions.map(suggestion => (
                <Pressable
                  key={suggestion}
                  onPress={() => {
                    onChange(value.slice(0, value.length - currentWord.length) + suggestion + ' ');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    inputRef.current?.focus();
                  }}
                  style={[styles.suggestionChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                >
                  <Text style={[styles.suggestionText, { color: colors.sqlKeyword }]}>{suggestion}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Snippet keyboard bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.snippetBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}
        contentContainerStyle={styles.snippetBarContent}
        keyboardShouldPersistTaps="always"
      >
        {SQL_SNIPPETS.map(s => (
          <Pressable
            key={s.label}
            onPress={() => insertSnippet(s.sql)}
            style={({ pressed }) => [
              styles.snippetChip,
              {
                backgroundColor: pressed ? colors.muted : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.snippetText, { fontFamily: MONO_FONT, color: colors.sqlKeyword }]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function DiagnosticChip({
  item,
  colors,
}: {
  item: SQLDiagnostic;
  colors: ReturnType<typeof useColors>;
}) {
  const color = item.severity === 'error'
    ? colors.destructive
    : item.severity === 'warning'
      ? colors.sqlString
      : colors.mutedForeground;
  return (
    <View style={[styles.diagnosticChip, { borderColor: color + '88', backgroundColor: color + '18' }]}>
      <MaterialIcons
        name={item.severity === 'error' ? 'error-outline' : item.severity === 'warning' ? 'warning-amber' : 'info-outline'}
        size={14}
        color={color}
      />
      <Text style={[styles.diagnosticText, { color }]} numberOfLines={1}>
        Ln {item.line}:{item.column} · {item.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  dbPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dbPillText: { fontSize: 12, fontWeight: '600', flex: 1 },
  flex1: { flex: 1 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: 8 },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 72,
    justifyContent: 'center',
  },
  runText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  editorWrapper: { flex: 1 },
  editorScroll: { flex: 1 },
  editorInner: { flexDirection: 'row', minHeight: '100%', paddingBottom: 20 },
  lineNumbers: {
    paddingTop: 14,
    paddingHorizontal: 8,
    minWidth: 42,
    alignItems: 'flex-end',
    borderRightWidth: 1,
  },
  lineNum: {
    fontFamily: MONO_FONT,
    minWidth: 20,
    textAlign: 'right',
  },
  codeInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    fontFamily: MONO_FONT,
    textAlignVertical: 'top',
  },
  snippetBar: {
    borderTopWidth: 1,
    maxHeight: 42,
    flexGrow: 0,
  },
  snippetBarContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
  },
  snippetChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  snippetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  assistPanel: { borderTopWidth: 1, maxHeight: 88 },
  diagnosticContent: { paddingHorizontal: 8, paddingVertical: 5, gap: 6 },
  diagnosticChip: {
    maxWidth: 330,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  diagnosticText: { fontSize: 11, maxWidth: 290 },
  suggestionContent: { paddingHorizontal: 8, paddingBottom: 5, gap: 5, alignItems: 'center' },
  assistLabel: { fontSize: 11, marginRight: 2 },
  suggestionChip: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  suggestionText: { fontSize: 11, fontFamily: MONO_FONT },
});
