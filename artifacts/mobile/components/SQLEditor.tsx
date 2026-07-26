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

  const currentWord = value.match(/[A-Za-z_][A-Za-z0-9_]*$/)?.[0] ?? '';

  const [schemaSuggestions, setSchemaSuggestions] = useState<string[]>([]);

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
  const hasWarning = diagnostics.some(d => d.severity === 'warning');

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
    const before = value.slice(0, value.length - currentWord.length);
    onChange(before + suggestion + ' ');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const runBgColor = isExecuting
    ? colors.muted
    : hasHardError
    ? colors.destructive + '22'
    : colors.primary;

  const runTextColor = isExecuting || hasHardError
    ? hasHardError ? colors.destructive : colors.mutedForeground
    : colors.primaryForeground;

  return (
    <View style={styles.container}>
      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* DB indicator pill */}
        {databaseName ? (
          <View style={[styles.dbPill, { backgroundColor: (databaseColor ?? colors.primary) + '1A' }]}>
            <View style={[styles.dbDot, { backgroundColor: databaseColor ?? colors.primary }]} />
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
          {/* Format button */}
          <Pressable onPress={handleFormat} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="color-wand-outline" size={17} color={colors.mutedForeground} />
          </Pressable>
          {/* Clear button */}
          {value.length > 0 && (
            <Pressable onPress={handleClear} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={17} color={colors.mutedForeground} />
            </Pressable>
          )}
          {/* Run button */}
          <Pressable
            onPress={handleRun}
            style={[styles.runButton, { backgroundColor: runBgColor }]}
            disabled={isExecuting || hasHardError}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={hasHardError ? 'ban-outline' : 'play'}
                size={13}
                color={runTextColor}
              />
            )}
            <Text style={[styles.runText, { color: runTextColor }]}>
              {isExecuting ? 'Running…' : hasHardError ? 'Error' : 'Run'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Editor: line numbers + TextInput ───────────────────────── */}
      <View style={[styles.editorWrapper, { backgroundColor: colors.editorBg }]}>
        <ScrollView style={styles.editorScroll} keyboardDismissMode="none">
          <View style={styles.editorInner}>
            {/* Line numbers */}
            <View style={[styles.lineNumbers, { borderRightColor: colors.border + '60' }]}>
              {Array.from({ length: lineCount }, (_, i) => (
                <Text
                  key={i}
                  style={[styles.lineNum, { color: colors.editorLineNumber, lineHeight, fontSize: fontSize - 1 }]}
                >
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
              placeholder="-- Write your SQLite query here…"
              placeholderTextColor={colors.editorLineNumber}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>

      {/* ── Diagnostics + autocomplete assist panel ─────────────────── */}
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

      {/* ── Snippet keyboard bar ────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.snippetBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}
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
                backgroundColor: pressed ? colors.primary + '22' : colors.muted,
                borderColor: pressed ? colors.primary + '60' : colors.border,
              },
            ]}
          >
            <Text style={[styles.snippetText, { fontFamily: MONO_FONT, color: colors.sqlKeyword }]}>
              {s.label}
            </Text>
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
      ? '#F59E0B'
      : colors.mutedForeground;
  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    item.severity === 'error' ? 'close-circle'
    : item.severity === 'warning' ? 'warning'
    : 'information-circle';
  return (
    <View style={[styles.diagnosticChip, { borderColor: color + '60', backgroundColor: color + '14' }]}>
      <Ionicons name={iconName} size={12} color={color} />
      <Text style={[styles.diagnosticText, { color }]} numberOfLines={1}>
        {item.line > 0 ? `Ln ${item.line} · ` : ''}{item.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    gap: 6,
  },
  dbPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  dbDot: { width: 6, height: 6, borderRadius: 3 },
  dbPillText: { fontSize: 11, fontWeight: '600', flex: 1 },
  flex1: { flex: 1 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  iconBtn: { padding: 7 },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 68,
    justifyContent: 'center',
  },
  runText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },

  // Editor
  editorWrapper: { flex: 1 },
  editorScroll: { flex: 1 },
  editorInner: { flexDirection: 'row', minHeight: '100%', paddingBottom: 20 },
  lineNumbers: {
    paddingTop: 13,
    paddingHorizontal: 8,
    minWidth: 40,
    alignItems: 'flex-end',
    borderRightWidth: 1,
  },
  lineNum: { fontFamily: MONO_FONT, minWidth: 18, textAlign: 'right' },
  codeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 13,
    fontFamily: MONO_FONT,
    textAlignVertical: 'top',
  },

  // Snippet bar
  snippetBar: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 38, flexGrow: 0 },
  snippetBarContent: { paddingHorizontal: 8, paddingVertical: 5, gap: 5, alignItems: 'center' },
  snippetChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  snippetText: { fontSize: 11, fontWeight: '600' },

  // Assist panel (diagnostics + autocomplete)
  assistPanel: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 80 },
  diagnosticContent: { paddingHorizontal: 8, paddingVertical: 5, gap: 5 },
  diagnosticChip: {
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  diagnosticText: { fontSize: 11, maxWidth: 300, flexShrink: 1 },
  suggestionContent: { paddingHorizontal: 8, paddingBottom: 5, gap: 5, alignItems: 'center' },
  assistLabel: { fontSize: 10, marginRight: 2, fontWeight: '600', letterSpacing: 0.2 },
  suggestionChip: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  suggestionText: { fontSize: 11, fontFamily: MONO_FONT },
});
