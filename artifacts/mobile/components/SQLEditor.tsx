import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { formatSQL } from '@/utils/sqlHighlight';
import {
  extractCTEAliases,
  extractTableAliases,
  getSQLSuggestions,
  getStaticSQLDiagnosticsWithOptions,
  type SQLDiagnostic,
} from '@/utils/sqlDiagnostics';
import { getSQLCompletionItems, isInTransaction } from '@/utils/sqliteManager';
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
  { label: 'LEFT JOIN', sql: '\nLEFT JOIN  ON .id = .id' },
  { label: 'GROUP BY', sql: '\nGROUP BY ' },
  { label: 'HAVING', sql: '\nHAVING COUNT(*) > 1' },
  { label: 'WITH', sql: 'WITH cte AS (\n  SELECT * FROM \n)\nSELECT * FROM cte' },
  { label: 'INSERT', sql: 'INSERT INTO  (col1, col2)\nVALUES (val1, val2)' },
  { label: 'UPSERT', sql: 'INSERT INTO  (col1, col2)\nVALUES (val1, val2)\nON CONFLICT (col1) DO UPDATE SET col2 = EXCLUDED.col2' },
  { label: 'UPDATE', sql: 'UPDATE \nSET col = val\nWHERE id = 1' },
  { label: 'DELETE', sql: 'DELETE FROM \nWHERE id = 1' },
  { label: 'CREATE TABLE', sql: 'CREATE TABLE  (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n)' },
  { label: 'CREATE INDEX', sql: 'CREATE INDEX idx_ ON  (column)' },
  { label: 'ALTER', sql: 'ALTER TABLE  ADD COLUMN  TEXT' },
  { label: 'DROP', sql: 'DROP TABLE IF EXISTS ' },
  { label: 'PRAGMA', sql: 'PRAGMA table_info()' },
  { label: 'EXPLAIN', sql: 'EXPLAIN QUERY PLAN\n' },
  { label: 'BEGIN', sql: 'BEGIN;\n\n-- your statements here\n\nCOMMIT;' },
  { label: 'SAVEPOINT', sql: 'SAVEPOINT sp1;\n\n-- your statements here\n\nRELEASE SAVEPOINT sp1;' },
  { label: 'COUNT', sql: 'SELECT COUNT(*) FROM ' },
  { label: 'DISTINCT', sql: 'SELECT DISTINCT  FROM ' },
  { label: 'WINDOW', sql: 'SELECT\n  *,\n  ROW_NUMBER() OVER (PARTITION BY  ORDER BY ) AS rn\nFROM ' },
  { label: 'IS NULL', sql: ' IS NULL' },
  { label: 'COALESCE', sql: 'COALESCE(, )' },
  { label: 'CAST', sql: 'CAST( AS INTEGER)' },
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineCount = value.split('\n').length;
  const fontSize = settings.fontSize;
  const lineHeight = Math.round(fontSize * 1.6);
  const diagnostics = getStaticSQLDiagnosticsWithOptions(value, {
    inTransaction: databaseId ? isInTransaction(databaseId) : false,
  });

  // The word currently being typed (for suggestion filtering)
  const currentWord = value.match(/[A-Za-z_][A-Za-z0-9_]*$/)?.[0] ?? '';

  const [schemaSuggestions, setSchemaSuggestions] = useState<string[]>([]);

  // Debounced schema fetch — re-runs when the SQL changes (CTE/alias extraction)
  // or when the databaseId changes. 300 ms debounce keeps typing responsive.
  const fetchCompletions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!settings.autoComplete || !databaseId) {
      setSchemaSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await getSQLCompletionItems(databaseId, value);
        setSchemaSuggestions([
          ...items.tables,
          ...items.views,
          ...items.columns,
          ...items.indexes,
          ...items.triggers,
          ...items.pragmas,
          ...items.functions,
          ...items.cteAliases,
          ...items.tableAliases,
        ]);
      } catch {
        setSchemaSuggestions([]);
      }
    }, 300);
  }, [databaseId, settings.autoComplete, value]);

  useEffect(() => {
    fetchCompletions();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchCompletions]);

  // Context-aware suggestions: if cursor is right after PRAGMA, show pragma names
  const isPragmaContext = /\bPRAGMA\s+[A-Za-z0-9_]*$/i.test(value);

  const suggestions = settings.autoComplete && currentWord.length > 0
    ? Array.from(new Set([
      ...getSQLSuggestions(currentWord),
      ...(isPragmaContext
        ? schemaSuggestions
        : schemaSuggestions.filter(item => item.toUpperCase().startsWith(currentWord.toUpperCase()))
      ),
    ])).slice(0, 12)
    : [];

  const handleFormat = () => {
    const formatted = formatSQL(value);
    onChange(formatted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const hasHardError = diagnostics.some(d => d.severity === 'error');

  const handleRun = () => {
    if (isExecuting || hasHardError) return;
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

  const applySuggestion = (suggestion: string) => {
    // Replace only the current word at the end of input, not a substring anywhere
    const before = value.slice(0, value.length - currentWord.length);
    onChange(before + suggestion + ' ');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {databaseName ? (
          <View style={[styles.dbPill, { backgroundColor: (databaseColor ?? colors.primary) + '22' }]}>
            <Ionicons name="server-outline" size={12} color={databaseColor ?? colors.primary} />
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
          <Pressable onPress={handleFormat} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="code-slash-outline" size={18} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={handleClear} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={18} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={handleRun}
            style={[
              styles.runButton,
              { backgroundColor: isExecuting || hasHardError ? colors.muted : colors.primary },
            ]}
            disabled={isExecuting || hasHardError}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={hasHardError ? 'ban' : 'play'}
                size={14}
                color={hasHardError ? colors.destructive : colors.primaryForeground}
              />
            )}
            <Text style={[
              styles.runText,
              { color: isExecuting || hasHardError ? colors.mutedForeground : colors.primaryForeground },
            ]}>
              {isExecuting ? 'Running' : hasHardError ? 'Error' : 'Run'}
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
              placeholder="-- Write your SQLite query here..."
              placeholderTextColor={colors.editorLineNumber}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>

      {/* Diagnostics + autocomplete assist panel */}
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
                  onPress={() => applySuggestion(suggestion)}
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
              { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border },
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
      ? '#FFA657'
      : colors.mutedForeground;
  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    item.severity === 'error' ? 'close-circle-outline'
    : item.severity === 'warning' ? 'warning-outline'
    : 'information-circle-outline';
  return (
    <View style={[styles.diagnosticChip, { borderColor: color + '80', backgroundColor: color + '18' }]}>
      <Ionicons name={iconName} size={13} color={color} />
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
  lineNum: { fontFamily: MONO_FONT, minWidth: 20, textAlign: 'right' },
  codeInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    fontFamily: MONO_FONT,
    textAlignVertical: 'top',
  },
  snippetBar: { borderTopWidth: 1, maxHeight: 42, flexGrow: 0 },
  snippetBarContent: { paddingHorizontal: 8, paddingVertical: 6, gap: 6, alignItems: 'center' },
  snippetChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  snippetText: { fontSize: 12, fontWeight: '600' },
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
