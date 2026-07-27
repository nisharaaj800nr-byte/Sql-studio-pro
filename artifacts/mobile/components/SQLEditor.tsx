/**
 * SQLEditor — Premium dark IDE component
 * Features: syntax-highlighting overlay, gradient Run button,
 * BEGIN/COMMIT/ROLLBACK inline toolbar, cursor position tracking,
 * info status bar, SQL keyword chips.
 */
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
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { formatSQL, tokenize, type TokenType } from '@/utils/sqlHighlight';
import {
  getSQLSuggestions,
  getStaticSQLDiagnosticsWithOptions,
  type SQLDiagnostic,
} from '@/utils/sqlDiagnostics';
import { getSQLCompletionItems, isInTransaction } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const LARGE_SQL_LINE_THRESHOLD = 250;
const LARGE_SQL_CHAR_THRESHOLD = 24_000;

// Visible SQL chips row — matches reference (8 core keywords)
const SQL_CHIPS = [
  { label: 'SELECT', sql: 'SELECT ' },
  { label: 'FROM', sql: ' FROM ' },
  { label: 'WHERE', sql: ' WHERE ' },
  { label: 'AND', sql: ' AND ' },
  { label: 'OR', sql: ' OR ' },
  { label: 'ORDER BY', sql: '\nORDER BY ' },
  { label: 'GROUP BY', sql: '\nGROUP BY ' },
  { label: 'LIMIT', sql: '\nLIMIT 100' },
];

// Full snippet set for expanded usage
const SQL_SNIPPETS = [
  { label: 'JOIN', sql: '\nINNER JOIN  ON .id = .id' },
  { label: 'LEFT JOIN', sql: '\nLEFT JOIN  ON .id = .id' },
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
  { label: 'SAVEPOINT', sql: 'SAVEPOINT sp1;\n\nRELEASE SAVEPOINT sp1;' },
  { label: 'COUNT', sql: 'SELECT COUNT(*) FROM ' },
  { label: 'DISTINCT', sql: 'SELECT DISTINCT  FROM ' },
  { label: 'WINDOW', sql: 'SELECT\n  *,\n  ROW_NUMBER() OVER (PARTITION BY  ORDER BY ) AS rn\nFROM ' },
];

// ── Token color mapping ──────────────────────────────────────────────────────

function getTokenColor(type: TokenType, colors: ReturnType<typeof useColors>): string {
  switch (type) {
    case 'keyword':    return colors.sqlKeyword;
    case 'string':     return '#56D364';  // green strings
    case 'comment':    return colors.sqlComment;
    case 'number':     return colors.sqlNumber;
    case 'function':   return colors.sqlFunction;
    case 'operator':   return colors.sqlOperator;
    case 'identifier': return '#A5D6FF';  // light blue identifiers
    case 'parameter':  return '#FFA657';  // orange params
    case 'punctuation':return colors.sqlPunctuation;
    case 'whitespace': return 'transparent';
    default:           return colors.editorText;
  }
}

// Render SQL with syntax highlighting spans
function HighlightedSQL({
  value,
  style,
}: {
  value: string;
  style: object;
}) {
  const colors = useColors();
  // Rendering thousands of nested <Text> nodes can exhaust the native view
  // tree on mobile. Large scripts still remain editable, but use plain text.
  if (value.length > LARGE_SQL_CHAR_THRESHOLD || value.split('\n').length > LARGE_SQL_LINE_THRESHOLD) {
    return (
      <Text style={[style, { color: colors.editorText }]} selectable={false}>
        {value}
      </Text>
    );
  }
  const tokens = tokenize(value);
  return (
    <Text style={style} selectable={false}>
      {tokens.map((token, i) => (
        <Text
          key={i}
          style={{ color: getTokenColor(token.type, colors) }}
        >
          {token.value}
        </Text>
      ))}
    </Text>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface SQLEditorProps {
  value: string;
  onChange: (text: string) => void;
  onRun: () => void;
  isExecuting?: boolean;
  databaseName?: string;
  databaseId?: string | null;
  databaseColor?: string;
  // Transaction props
  inTransaction?: boolean;
  txLoading?: boolean;
  onBegin?: () => void;
  onCommit?: () => void;
  onRollback?: () => void;
  // Misc
  onOpenSettings?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SQLEditor({
  value,
  onChange,
  onRun,
  isExecuting = false,
  databaseName,
  databaseId,
  databaseColor,
  inTransaction = false,
  txLoading = false,
  onBegin,
  onCommit,
  onRollback,
  onOpenSettings,
}: SQLEditorProps) {
  const colors = useColors();
  const { settings } = useSettings();
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lineCount = value.split('\n').length;
  const isLargeDocument =
    lineCount > LARGE_SQL_LINE_THRESHOLD || value.length > LARGE_SQL_CHAR_THRESHOLD;
  const fontSize = settings.fontSize ?? 13;
  const lineHeight = Math.round(fontSize * 1.65);

  // Cursor position
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const handleSelectionChange = useCallback((e: any) => {
    const start: number = e.nativeEvent?.selection?.start ?? 0;
    const before = value.slice(0, start);
    const lines = before.split('\n');
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  }, [value]);

  // Diagnostics
  const diagnostics = isLargeDocument
    ? []
    : getStaticSQLDiagnosticsWithOptions(value, {
        inTransaction: databaseId ? isInTransaction(databaseId) : false,
      });
  const hasHardError = diagnostics.some(d => d.severity === 'error');

  // Auto-complete
  const currentWord = value.match(/[A-Za-z_][A-Za-z0-9_]*$/)?.[0] ?? '';
  const [schemaSuggestions, setSchemaSuggestions] = useState<string[]>([]);

  const fetchCompletions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isLargeDocument || !settings.autoComplete || !databaseId) {
      setSchemaSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await getSQLCompletionItems(databaseId, value);
        setSchemaSuggestions([
          ...items.tables, ...items.views, ...items.columns, ...items.indexes,
          ...items.triggers, ...items.pragmas, ...items.functions,
          ...items.cteAliases, ...items.tableAliases,
        ]);
      } catch { setSchemaSuggestions([]); }
    }, 300);
  }, [databaseId, isLargeDocument, settings.autoComplete, value]);

  useEffect(() => {
    fetchCompletions();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchCompletions]);

  const suggestions = settings.autoComplete && currentWord.length > 0
    ? Array.from(new Set([
        ...getSQLSuggestions(currentWord),
        ...schemaSuggestions.filter(item =>
          item.toUpperCase().startsWith(currentWord.toUpperCase())
        ),
      ])).slice(0, 12)
    : [];

  // Actions
  const handleFormat = () => {
    onChange(formatSQL(value));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRun = () => {
    if (isExecuting || hasHardError) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRun();
  };

  const insertChip = (sql: string) => {
    onChange(value + sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const applySuggestion = (suggestion: string) => {
    const before = value.slice(0, value.length - currentWord.length);
    onChange(before + suggestion + ' ');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  // Hint text derived from SQL content
  const getHint = () => {
    const upper = value.toUpperCase();
    if (upper.includes('SELECT *')) return 'SELECT * returns every column • See by columns exp...';
    if (upper.includes('SELECT')) return 'SELECT query • Run to see results';
    if (upper.includes('INSERT')) return 'INSERT statement • Use WITH RETURNING to check inserted rows';
    if (upper.includes('UPDATE')) return 'UPDATE statement • Backs up automatically if destructive';
    if (upper.includes('DELETE')) return 'DELETE statement • Will auto-backup before execution';
    if (upper.includes('PRAGMA')) return 'PRAGMA • SQLite configuration command';
    return 'Write a query above and press Run';
  };

  // Shared code style — must be IDENTICAL on both Text overlay and TextInput
  const codeStyle = {
    fontFamily: MONO_FONT,
    fontSize,
    lineHeight,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 20,
  } as const;

  // Transaction toolbar content
  const renderTxButton = () => {
    if (txLoading) {
      return (
        <View style={s.beginBtn}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (!inTransaction) {
      return (
        <Pressable
          onPress={onBegin}
          style={({ pressed }) => [s.beginBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={6}
        >
          <Ionicons name="play" size={11} color="#E6EDF3" />
          <Text style={s.beginText}>BEGIN</Text>
        </Pressable>
      );
    }
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable
          onPress={onCommit}
          style={({ pressed }) => [s.commitBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={6}
        >
          <Ionicons name="checkmark" size={11} color="#3FB950" />
          <Text style={[s.beginText, { color: '#3FB950' }]}>COMMIT</Text>
        </Pressable>
        <Pressable
          onPress={onRollback}
          style={({ pressed }) => [s.rollbackBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={6}
        >
          <Ionicons name="arrow-undo" size={11} color="#F85149" />
          <Text style={[s.beginText, { color: '#F85149' }]}>ROLLBACK</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={s.container}>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <View style={[s.toolbar, { backgroundColor: '#0D1117', borderBottomColor: '#21262D' }]}>
        {/* LEFT: BEGIN / COMMIT / ROLLBACK */}
        {renderTxButton()}

        {/* Transaction open indicator */}
        {inTransaction && (
          <View style={s.txIndicator}>
            <View style={s.txDot} />
          </View>
        )}

        <View style={s.toolbarSpacer} />

        {/* RIGHT: format / settings / run */}
        <Pressable onPress={handleFormat} style={s.toolbarIconBtn} hitSlop={8}>
          <Ionicons name="sparkles-outline" size={18} color="#7D8590" />
        </Pressable>
        <Pressable onPress={onOpenSettings} style={s.toolbarIconBtn} hitSlop={8}>
          <Ionicons name="settings-outline" size={18} color="#7D8590" />
        </Pressable>

        {/* Gradient Run button */}
        <Pressable onPress={handleRun} disabled={isExecuting || hasHardError} style={s.runPressable}>
          <LinearGradient
            colors={isExecuting || hasHardError ? ['#1E2336', '#1E2336'] : ['#4B7BFF', '#7C5CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.runGradient}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={hasHardError ? 'ban-outline' : 'play'}
                size={12}
                color={hasHardError ? '#F85149' : '#fff'}
              />
            )}
            <Text style={[s.runText, { color: hasHardError ? '#F85149' : '#fff' }]}>
              {isExecuting ? 'Running…' : hasHardError ? 'Error' : 'Run'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── Editor: line numbers + syntax highlighted input ───────── */}
      <ScrollView
        style={[s.editorScroll, { backgroundColor: '#090D12' }]}
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.editorInner}>

          {/* Line numbers */}
          <View style={[s.lineNums, { borderRightColor: '#21262D' }]}>
            {isLargeDocument ? (
              <Text style={[s.lineNum, { color: '#3D444D', fontSize: fontSize - 1, lineHeight }]}>
                {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
              </Text>
            ) : (
              Array.from({ length: lineCount }, (_, i) => (
                <Text
                  key={i}
                  style={[s.lineNum, { color: '#3D444D', fontSize: fontSize - 1, lineHeight }]}
                >
                  {i + 1}
                </Text>
              ))
            )}
          </View>

          {/* Code area: highlighted overlay + transparent input */}
          <View style={{ flex: 1 }}>
            {/* Syntax highlighted text (behind) */}
            <HighlightedSQL
              value={value}
              style={[codeStyle, s.codeOverlay]}
            />
            {/* Transparent TextInput (on top — captures input, shows cursor) */}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChange}
              onSelectionChange={handleSelectionChange}
              style={[codeStyle, s.codeInput, { minHeight: lineCount * lineHeight + 34 }]}
              multiline
              scrollEnabled={false}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              keyboardType="ascii-capable"
              selectionColor="#58A6FF"
              placeholderTextColor="#3D444D"
              placeholder="-- Write your SQLite query here…"
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Autocomplete suggestions ─────────────────────────────── */}
      {suggestions.length > 0 && currentWord.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[s.suggestBar, { backgroundColor: '#0D1117', borderTopColor: '#21262D' }]}
          contentContainerStyle={s.suggestContent}
          keyboardShouldPersistTaps="always"
        >
          <Text style={s.suggestLabel}>Suggest</Text>
          {suggestions.map(s2 => (
            <Pressable
              key={s2}
              onPress={() => applySuggestion(s2)}
              style={[s.suggestChip, { backgroundColor: '#111820', borderColor: '#21262D' }]}
            >
              <Text style={[s.suggestText, { color: '#79C0FF' }]}>{s2}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Combined info / diagnostic status bar ────────────────── */}
      {(() => {
        // Show first diagnostic if present, otherwise show cursor hint
        const firstDiag = diagnostics[0];
        const diagColor = firstDiag
          ? firstDiag.severity === 'error' ? '#F85149'
            : firstDiag.severity === 'warning' ? '#F0A000'
            : '#58A6FF'
          : '#4B7BFF';
        const diagIcon: React.ComponentProps<typeof Ionicons>['name'] = firstDiag
          ? firstDiag.severity === 'error' ? 'close-circle'
            : firstDiag.severity === 'warning' ? 'warning'
            : 'information-circle'
          : 'information-circle';
        const infoMsg = firstDiag
          ? `${firstDiag.line > 0 ? `Ln ${firstDiag.line} · ` : ''}${firstDiag.message}`
            : isLargeDocument
              ? 'Large script — lightweight mode enabled; validation and autocomplete are paused'
              : getHint();

        return (
          <View style={[s.infoBar, { backgroundColor: '#0D1117', borderTopColor: '#21262D' }]}>
            <Ionicons name={diagIcon} size={14} color={diagColor} style={{ marginRight: 4 }} />
            <Text style={s.infoText} numberOfLines={1}>
              <Text style={s.infoCursor}>Ln {cursorPos.line}, Col {cursorPos.col}</Text>
              <Text style={s.infoDot}>  •  </Text>
              <Text style={{ color: firstDiag ? diagColor : '#7D8590' }}>{infoMsg}</Text>
            </Text>
            <Ionicons name="chevron-down" size={14} color="#3D444D" style={{ marginLeft: 4 }} />
          </View>
        );
      })()}

      {/* ── SQL keyword chips ────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.chipBar, { backgroundColor: '#0D1117', borderTopColor: '#21262D' }]}
        contentContainerStyle={s.chipContent}
        keyboardShouldPersistTaps="always"
      >
        {SQL_CHIPS.map(chip => (
          <Pressable
            key={chip.label}
            onPress={() => insertChip(chip.sql)}
            style={({ pressed }) => [
              s.chip,
              {
                backgroundColor: pressed ? '#1E2A4A' : '#111820',
                borderColor: pressed ? '#4B7BFF55' : '#21262D',
              },
            ]}
          >
            <Text style={[s.chipText, { color: '#79C0FF', fontFamily: MONO_FONT }]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
        {/* Separator */}
        <View style={s.chipSep} />
        {/* Additional snippets */}
        {SQL_SNIPPETS.map(chip => (
          <Pressable
            key={chip.label}
            onPress={() => insertChip(chip.sql)}
            style={({ pressed }) => [
              s.chip,
              {
                backgroundColor: pressed ? '#1E2A4A' : '#111820',
                borderColor: pressed ? '#4B7BFF55' : '#21262D',
              },
            ]}
          >
            <Text style={[s.chipText, { color: '#7D8590', fontFamily: MONO_FONT }]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Diagnostic chip ──────────────────────────────────────────────────────────

function DiagnosticChip({ item }: { item: SQLDiagnostic }) {
  const color = item.severity === 'error' ? '#F85149'
    : item.severity === 'warning' ? '#F0A000' : '#7D8590';
  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    item.severity === 'error' ? 'close-circle'
    : item.severity === 'warning' ? 'warning' : 'information-circle';
  return (
    <View style={[dc.chip, { borderColor: color + '60', backgroundColor: color + '14' }]}>
      <Ionicons name={iconName} size={12} color={color} />
      <Text style={[dc.text, { color }]} numberOfLines={1}>
        {item.line > 0 ? `Ln ${item.line} · ` : ''}{item.message}
      </Text>
    </View>
  );
}

const dc = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 4, maxWidth: 340,
  },
  text: { fontSize: 11, maxWidth: 300, flexShrink: 1 },
});

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    gap: 6,
    minHeight: 46,
  },
  beginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363D',
    backgroundColor: '#161B22',
  },
  commitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#1a3a1a',
    backgroundColor: '#0D2A0D',
  },
  rollbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#3a1a1a',
    backgroundColor: '#2A0D0D',
  },
  beginText: { fontSize: 12, fontWeight: '700', color: '#E6EDF3', letterSpacing: 0.3 },
  txIndicator: { marginLeft: 4 },
  txDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFA657' },
  toolbarSpacer: { flex: 1 },
  toolbarIconBtn: { padding: 6 },
  runPressable: { marginLeft: 4 },
  runGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 72,
    justifyContent: 'center',
  },
  runText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },

  // Editor
  editorScroll: { flex: 1 },
  editorInner: { flexDirection: 'row', minHeight: 200 },
  lineNums: {
    paddingTop: 14,
    paddingHorizontal: 8,
    minWidth: 40,
    alignItems: 'flex-end',
    borderRightWidth: 1,
  },
  lineNum: { fontFamily: MONO_FONT, minWidth: 18, textAlign: 'right' },

  // Code overlay + input — must share same font/padding
  codeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    color: '#E6EDF3',
    pointerEvents: 'none',
  } as any,
  codeInput: {
    color: 'transparent',
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },

  // Info bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: { flex: 1, fontSize: 11, color: '#7D8590' },
  infoCursor: { color: '#C9D1D9', fontWeight: '500' },
  infoDot: { color: '#3D444D' },

  // SQL chips
  chipBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 40,
    flexGrow: 0,
  },
  chipContent: { paddingHorizontal: 10, paddingVertical: 6, gap: 6, alignItems: 'center' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11, fontWeight: '600' },
  chipSep: { width: 1, height: 18, backgroundColor: '#21262D', marginHorizontal: 2 },

  // Suggestions
  suggestBar: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 36, flexGrow: 0 },
  suggestContent: { paddingHorizontal: 10, paddingVertical: 4, gap: 6, alignItems: 'center' },
  suggestLabel: { fontSize: 10, color: '#7D8590', fontWeight: '600', marginRight: 2 },
  suggestChip: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  suggestText: { fontSize: 11, fontFamily: MONO_FONT },

  // Diagnostics
  diagBar: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 38, flexGrow: 0 },
  diagContent: { paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
});
