/**
 * SQL Assistant — Premium Tab Screen
 * Visual parity with reference design: dark theme, glow accents, glassmorphism.
 */
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { getColumns } from '@/utils/sqliteManager';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#090D14',
  cardBg:      '#0D1420',
  cardBorder:  '#1A2438',
  codeBg:      '#07101C',
  codeBorder:  '#152035',
  chip:        '#0D1420',
  chipBorder:  '#1A2438',
  activeChip:  '#4B7BFF',
  tabLine:     '#4B7BFF',
  tabActive:   '#4B7BFF',
  tabInactive: '#4A5568',
  searchBg:    '#0D1420',
  searchBorder:'#1A2438',
  textPrimary: '#E8EEFF',
  textMuted:   '#4A5568',
  textPlaceholder: '#2D3A50',
  btnGrad:     ['#3B5BFF', '#6E3AFF'] as const,
};

// ─── SQL templates ──────────────────────────────────────────────────────────────
const SQL_TEMPLATES = [
  {
    title: 'List Tables',
    category: 'Schema',
    icon: 'table-chart',
    sql: "SELECT name, type, sql\nFROM sqlite_master\nWHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'\nORDER BY type, name;",
  },
  {
    title: 'Create Table',
    category: 'DDL',
    icon: 'add-box',
    sql: "CREATE TABLE IF NOT EXISTS users (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE NOT NULL,\n  created_at TEXT DEFAULT (datetime('now'))\n);",
  },
  {
    title: 'Select All',
    category: 'DQL',
    icon: 'filter-list',
    sql: 'SELECT * FROM users\nLIMIT 100;',
  },
  {
    title: 'Join Tables',
    category: 'DQL',
    icon: 'merge-type',
    sql: 'SELECT u.name, o.product, o.amount\nFROM users u\nINNER JOIN orders o ON o.user_id = u.id\nORDER BY o.created_at DESC;',
  },
  {
    title: 'Group & Count',
    category: 'DQL',
    icon: 'bar-chart',
    sql: 'SELECT category, COUNT(*) AS total\nFROM orders\nGROUP BY category\nORDER BY total DESC;',
  },
  {
    title: 'Insert Row',
    category: 'DML',
    icon: 'add-circle-outline',
    sql: "INSERT INTO users (name, email)\nVALUES ('Alice', 'alice@example.com');",
  },
  {
    title: 'Update Rows',
    category: 'DML',
    icon: 'edit',
    sql: "UPDATE users\nSET email = 'new@example.com'\nWHERE id = 1;",
  },
  {
    title: 'Delete Rows',
    category: 'DML',
    icon: 'delete-outline',
    sql: "DELETE FROM users\nWHERE created_at < date('now', '-1 year');",
  },
  {
    title: 'Create Index',
    category: 'DDL',
    icon: 'speed',
    sql: 'CREATE INDEX IF NOT EXISTS idx_users_email\nON users (email);',
  },
  {
    title: 'Explain Plan',
    category: 'Analysis',
    icon: 'analytics',
    sql: "EXPLAIN QUERY PLAN\nSELECT * FROM users WHERE email = 'alice@example.com';",
  },
  {
    title: 'Integrity Check',
    category: 'PRAGMA',
    icon: 'health-and-safety',
    sql: 'PRAGMA integrity_check;\nPRAGMA foreign_key_check;',
  },
  {
    title: 'Transaction',
    category: 'Transaction',
    icon: 'layers',
    sql: 'BEGIN TRANSACTION;\n\n-- your queries here\n\nCOMMIT;',
  },
];

const CAT_COLORS: Record<string, string> = {
  DDL:         '#58A6FF',
  DQL:         '#3FB950',
  DML:         '#FFA657',
  PRAGMA:      '#D2A8FF',
  Schema:      '#79C0FF',
  Analysis:    '#F78166',
  Transaction: '#E3B341',
};

const CATEGORIES = ['All', ...Array.from(new Set(SQL_TEMPLATES.map(t => t.category)))];

// ─── SQL Syntax Highlighter ─────────────────────────────────────────────────────

type Token = { text: string; color: string };

const DQL_RE  = /^(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|IN|IS|NOT|NULL|LIKE|BETWEEN|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|CASE|WHEN|THEN|ELSE|END|WITH|RECURSIVE|EXPLAIN|QUERY|PLAN|ANALYZE)\b/i;
const DDL_RE  = /^(CREATE|DROP|ALTER|TABLE|INDEX|VIEW|TRIGGER|PRIMARY|FOREIGN|KEY|REFERENCES|UNIQUE|CHECK|DEFAULT|AUTOINCREMENT|IF|EXISTS|COLUMN|CONSTRAINT)\b/i;
const DML_RE  = /^(INSERT|INTO|VALUES|UPDATE|SET|DELETE|REPLACE)\b/i;
const TXN_RE  = /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;
const PRA_RE  = /^(PRAGMA)\b/i;

const SQL_COLORS = {
  dql:  '#FF7B72',
  ddl:  '#79C0FF',
  dml:  '#FFA657',
  txn:  '#D2A8FF',
  pra:  '#D2A8FF',
  str:  '#56D364',
  cmt:  '#4A5568',
  num:  '#56D364',
  op:   '#FF7B72',
  punc: '#8B949E',
  id:   '#C9D1D9',
};

function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let rem = sql;

  while (rem.length > 0) {
    let m: RegExpMatchArray | null;

    // Comment
    if ((m = rem.match(/^(--[^\n]*)/))) {
      tokens.push({ text: m[1], color: SQL_COLORS.cmt });
      rem = rem.slice(m[1].length);
      continue;
    }
    // String literal
    if ((m = rem.match(/^('[^']*'|"[^"]*")/))) {
      tokens.push({ text: m[1], color: SQL_COLORS.str });
      rem = rem.slice(m[1].length);
      continue;
    }
    // Number
    if ((m = rem.match(/^(\b\d+\.?\d*\b)/))) {
      tokens.push({ text: m[1], color: SQL_COLORS.num });
      rem = rem.slice(m[1].length);
      continue;
    }
    // PRAGMA
    if ((m = rem.match(PRA_RE))) {
      tokens.push({ text: m[1], color: SQL_COLORS.pra });
      rem = rem.slice(m[1].length);
      continue;
    }
    // Transaction keywords
    if ((m = rem.match(TXN_RE))) {
      tokens.push({ text: m[1], color: SQL_COLORS.txn });
      rem = rem.slice(m[1].length);
      continue;
    }
    // DDL keywords
    if ((m = rem.match(DDL_RE))) {
      tokens.push({ text: m[1], color: SQL_COLORS.ddl });
      rem = rem.slice(m[1].length);
      continue;
    }
    // DML keywords
    if ((m = rem.match(DML_RE))) {
      tokens.push({ text: m[1], color: SQL_COLORS.dml });
      rem = rem.slice(m[1].length);
      continue;
    }
    // DQL / control keywords
    if ((m = rem.match(DQL_RE))) {
      tokens.push({ text: m[1], color: SQL_COLORS.dql });
      rem = rem.slice(m[1].length);
      continue;
    }
    // Operator
    if ((m = rem.match(/^([=<>!+\-*\/]+)/))) {
      tokens.push({ text: m[1], color: SQL_COLORS.op });
      rem = rem.slice(m[1].length);
      continue;
    }
    // Punctuation
    if ((m = rem.match(/^([;,.()\[\]])/))) {
      tokens.push({ text: m[1], color: SQL_COLORS.punc });
      rem = rem.slice(m[1].length);
      continue;
    }
    // Identifier or whitespace
    if ((m = rem.match(/^(\w+)/))) {
      tokens.push({ text: m[1], color: SQL_COLORS.id });
      rem = rem.slice(m[1].length);
      continue;
    }
    // Any char (whitespace, newline, etc.)
    tokens.push({ text: rem[0], color: SQL_COLORS.id });
    rem = rem.slice(1);
  }

  return tokens;
}

// ─── SyntaxBlock ───────────────────────────────────────────────────────────────

function SyntaxBlock({ code }: { code: string }) {
  const tokens = useMemo(() => tokenizeSql(code), [code]);

  return (
    <View style={sb.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={sb.scroll}
        contentContainerStyle={sb.content}
      >
        <Text style={sb.text}>
          {tokens.map((tok, i) => (
            <Text key={i} style={{ color: tok.color }}>
              {tok.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: {
    backgroundColor: C.codeBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.codeBorder,
    overflow: 'hidden',
  },
  scroll: { maxHeight: 96 },
  content: { padding: 12 },
  text: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 20,
  },
});

// ─── TemplateCard ──────────────────────────────────────────────────────────────

interface Template {
  title: string;
  category: string;
  icon: string;
  sql: string;
}

function TemplateCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: (sql: string) => void;
}) {
  const catColor = CAT_COLORS[template.category] ?? '#58A6FF';

  return (
    <View style={card.wrap}>
      {/* Header */}
      <View style={card.header}>
        <View style={[card.iconBox, { backgroundColor: catColor + '22' }]}>
          <MaterialIcons
            name={template.icon as any}
            size={20}
            color={catColor}
          />
        </View>
        <Text style={card.title}>{template.title}</Text>
        <View style={[card.badge, { backgroundColor: catColor + '20' }]}>
          <Text style={[card.badgeText, { color: catColor }]}>
            {template.category}
          </Text>
        </View>
      </View>

      {/* Syntax-highlighted code */}
      <SyntaxBlock code={template.sql} />

      {/* Gradient "Use in Editor" button */}
      <Pressable
        onPress={() => onUse(template.sql)}
        style={({ pressed }) => [card.btnWrap, { opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={C.btnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={card.btnGrad}
        >
          <Text style={card.btnIcon}>{'</>'}</Text>
          <Text style={card.btnLabel}>Use in Editor</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 12,
    // subtle glow
    shadowColor: '#4B7BFF',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnWrap: { borderRadius: 12, overflow: 'hidden' },
  btnGrad: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
  },
  btnIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
});

// ─── Category Chip ─────────────────────────────────────────────────────────────

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        chip.base,
        active
          ? { backgroundColor: C.activeChip, borderColor: C.activeChip }
          : { backgroundColor: C.chip, borderColor: C.chipBorder },
      ]}
    >
      <Text
        style={[
          chip.label,
          { color: active ? '#FFFFFF' : C.tabInactive },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const chip = StyleSheet.create({
  base: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: '600' },
});

// ─── Chat bubble helpers ────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  isError?: boolean;
}

function buildHeuristicSql(prompt: string): string | null {
  const p = prompt.toLowerCase().trim();
  if (/show|list|what (tables|views)|all tables/.test(p))
    return "SELECT name, type FROM sqlite_master\nWHERE type IN ('table','view')\nORDER BY type, name;";
  if (/count.*rows|how many rows|number of rows/.test(p)) {
    const table = p.match(/(?:in|from)\s+(\w+)/)?.[1];
    return table
      ? `SELECT COUNT(*) AS row_count FROM "${table}";`
      : '-- Specify table: SELECT COUNT(*) AS row_count FROM "your_table";';
  }
  if (/schema|structure|columns|describe/.test(p)) {
    const table = p.match(/(?:of|for|in|table)\s+(\w+)/)?.[1];
    return table
      ? `PRAGMA table_info("${table}");`
      : '-- Specify table: PRAGMA table_info("your_table");';
  }
  if (/select all|show all|get all|fetch all/.test(p)) {
    const table = p.match(/(?:from|in)\s+(\w+)/)?.[1];
    return table
      ? `SELECT * FROM "${table}"\nLIMIT 100;`
      : '-- Specify table: SELECT * FROM "your_table" LIMIT 100;';
  }
  if (/recent|latest|newest|last/.test(p)) {
    const table = p.match(/(?:from|in)\s+(\w+)/)?.[1];
    const num = p.match(/(\d+)/)?.[1] ?? '10';
    return table
      ? `SELECT * FROM "${table}"\nORDER BY rowid DESC\nLIMIT ${num};`
      : `-- Specify table: SELECT * FROM "your_table" ORDER BY rowid DESC LIMIT ${num};`;
  }
  if (/delete|remove/.test(p)) {
    const table = p.match(/(?:from|in)\s+(\w+)/)?.[1];
    return table
      ? `-- CAUTION: preview with SELECT first\nDELETE FROM "${table}"\nWHERE id = ?;`
      : '-- Specify table and condition for DELETE';
  }
  if (/insert|add/.test(p)) {
    const table = p.match(/(?:into|to)\s+(\w+)/)?.[1];
    return table
      ? `INSERT INTO "${table}" (col1, col2)\nVALUES (val1, val2);`
      : '-- Specify table: INSERT INTO "your_table" (col) VALUES (val);';
  }
  if (/update|change|modify/.test(p)) {
    const table = p.match(/(?:in|update)\s+(\w+)/)?.[1];
    return table
      ? `UPDATE "${table}"\nSET column = new_value\nWHERE id = ?;`
      : '-- Specify table: UPDATE "your_table" SET col = val WHERE id = ?;';
  }
  return null;
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

const TAB_BAR_H = Platform.OS === 'ios' ? 80 : 64;

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { setCurrentSql } = useEditor();
  const { activeDbId } = useDatabases();

  const [activeTab, setActiveTab] = useState<'chat' | 'templates'>('templates');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! Describe what SQL you need and I'll generate it for you.\n\nExamples:\n• \"Show all tables\"\n• \"Count rows in users table\"\n• \"Select latest 10 from orders\"",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Filtered templates ──────────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    return SQL_TEMPLATES.filter(t => {
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.sql.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCat === 'All' || t.category === selectedCat;
      return matchesSearch && matchesCat;
    });
  }, [search, selectedCat]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUseTemplate = useCallback(
    (sql: string) => {
      setCurrentSql(sql);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/(tabs)/editor');
    },
    [setCurrentSql]
  );

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const heuristicSql = buildHeuristicSql(text);
      const assistantMsg: Message = heuristicSql
        ? { id: `a_${Date.now()}`, role: 'assistant', content: "Here's the SQL for that:", sql: heuristicSql }
        : {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content:
              'For complex queries, try rephrasing or use the Templates tab for common patterns.\n\nTip: mention the table name and exactly what you want.',
          };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { id: `e_${Date.now()}`, role: 'assistant', content: `Error: ${(e as Error).message}`, isError: true },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>

      {/* ── App bar ── */}
      <View style={[s.appBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={C.textPrimary} />
        </Pressable>
        <Text style={s.appBarTitle}>SQL Assistant</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Tab switcher ── */}
      <View style={s.tabRow}>
        <Pressable
          onPress={() => setActiveTab('chat')}
          style={[s.tabBtn, activeTab === 'chat' && s.tabBtnActive]}
        >
          <MaterialCommunityIcons
            name="chat-outline"
            size={16}
            color={activeTab === 'chat' ? C.tabActive : C.tabInactive}
          />
          <Text style={[s.tabBtnLabel, { color: activeTab === 'chat' ? C.tabActive : C.tabInactive }]}>
            AI Chat
          </Text>
          {activeTab === 'chat' && <View style={s.tabIndicator} />}
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('templates')}
          style={[s.tabBtn, activeTab === 'templates' && s.tabBtnActive]}
        >
          <MaterialIcons
            name="grid-view"
            size={16}
            color={activeTab === 'templates' ? C.tabActive : C.tabInactive}
          />
          <Text style={[s.tabBtnLabel, { color: activeTab === 'templates' ? C.tabActive : C.tabInactive }]}>
            Templates
          </Text>
          {activeTab === 'templates' && <View style={s.tabIndicator} />}
        </Pressable>
      </View>

      <View style={s.tabDivider} />

      {/* ═════════════════════════ TEMPLATES TAB ════════════════════════════ */}
      {activeTab === 'templates' && (
        <View style={{ flex: 1 }}>
          {/* Search bar */}
          <View style={s.searchWrap}>
            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={17} color={C.textMuted} style={{ marginRight: 2 }} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search templates..."
                placeholderTextColor={C.textPlaceholder}
                style={s.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={C.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipsScroll}
            contentContainerStyle={s.chipsContent}
          >
            {CATEGORIES.map(cat => (
              <CategoryChip
                key={cat}
                label={cat}
                active={selectedCat === cat}
                onPress={() => {
                  setSelectedCat(cat);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              />
            ))}
          </ScrollView>

          {/* Template card list */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              s.listContent,
              { paddingBottom: insets.bottom + TAB_BAR_H + 20 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {filteredTemplates.length === 0 ? (
              <View style={s.noResults}>
                <Ionicons name="search-outline" size={32} color={C.textMuted} />
                <Text style={s.noResultsText}>No templates found</Text>
              </View>
            ) : (
              filteredTemplates.map(t => (
                <TemplateCard
                  key={t.title}
                  template={t}
                  onUse={handleUseTemplate}
                />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ═════════════════════════ CHAT TAB ══════════════════════════════════ */}
      {activeTab === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={120}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              s.chatContent,
              { paddingBottom: insets.bottom + TAB_BAR_H + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(msg => (
              <View
                key={msg.id}
                style={[
                  s.bubble,
                  msg.role === 'user' ? s.userBubble : s.aiBubble,
                ]}
              >
                {msg.role === 'assistant' && (
                  <View style={s.aiAvatar}>
                    <MaterialCommunityIcons
                      name="robot-outline"
                      size={14}
                      color={C.tabActive}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      s.bubbleText,
                      {
                        color: msg.role === 'user'
                          ? '#FFFFFF'
                          : msg.isError
                          ? '#F85149'
                          : C.textPrimary,
                      },
                    ]}
                  >
                    {msg.content}
                  </Text>
                  {msg.sql && (
                    <View style={s.sqlBlock}>
                      <SyntaxBlock code={msg.sql} />
                      <Pressable
                        onPress={() => handleUseTemplate(msg.sql!)}
                        style={({ pressed }) => [
                          s.useSqlBtnWrap,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <LinearGradient
                          colors={C.btnGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.useSqlBtn}
                        >
                          <Text style={s.useSqlBtnText}>{'</>'} Use in Editor</Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {isLoading && (
              <View style={[s.bubble, s.aiBubble]}>
                <ActivityIndicator size="small" color={C.tabActive} />
                <Text style={[s.bubbleText, { color: C.tabInactive, marginLeft: 8 }]}>
                  Thinking...
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Input bar */}
          <View
            style={[
              s.inputBar,
              { paddingBottom: (insets.bottom || 12) + 8 },
            ]}
          >
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe the SQL you need..."
              placeholderTextColor={C.textPlaceholder}
              style={s.chatInput}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
            <Pressable
              onPress={handleSend}
              disabled={!prompt.trim() || isLoading}
              style={({ pressed }) => [
                s.sendBtnWrap,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <LinearGradient
                colors={prompt.trim() && !isLoading ? C.btnGrad : ['#1A2438', '#1A2438']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.sendBtn}
              >
                <Ionicons
                  name="send"
                  size={17}
                  color={prompt.trim() && !isLoading ? '#FFFFFF' : C.tabInactive}
                />
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // App bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#0D1420',
    borderWidth: 1,
    borderColor: '#1A2438',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#E8EEFF',
    letterSpacing: -0.3,
  },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
    gap: 7,
    position: 'relative',
  },
  tabBtnActive: {},
  tabBtnLabel: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 2,
    backgroundColor: C.tabLine,
  },
  tabDivider: {
    height: 1,
    backgroundColor: '#1A2438',
    marginBottom: 0,
  },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingVertical: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.searchBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.searchBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.textPrimary,
    letterSpacing: 0.1,
  },

  // Chips
  chipsScroll: { flexGrow: 0 },
  chipsContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
  },

  // Template list
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 14,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  noResultsText: { fontSize: 15, color: C.tabInactive, fontWeight: '500' },

  // Chat
  chatContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  bubble: { flexDirection: 'row', gap: 8 },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    backgroundColor: '#4B7BFF',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 12,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: '#0D1420',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1A2438',
    padding: 12,
  },
  aiAvatar: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  sqlBlock: { marginTop: 10, gap: 8 },
  useSqlBtnWrap: { borderRadius: 10, overflow: 'hidden' },
  useSqlBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useSqlBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Chat input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A2438',
    gap: 10,
    backgroundColor: C.bg,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0D1420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A2438',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: C.textPrimary,
    maxHeight: 100,
  },
  sendBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  sendBtn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
});
