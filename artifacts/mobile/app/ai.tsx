import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { getTables, getColumns } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

// ─── SQL Templates (kept as quick-start) ──────────────────────────────────────
const SQL_TEMPLATES = [
  { title: 'List Tables', category: 'Schema', icon: 'table-chart', sql: "SELECT name, type, sql\nFROM sqlite_master\nWHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'\nORDER BY type, name;" },
  { title: 'Create Table', category: 'DDL', icon: 'add-box', sql: "CREATE TABLE IF NOT EXISTS users (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE NOT NULL,\n  created_at TEXT DEFAULT (datetime('now'))\n);" },
  { title: 'Select All', category: 'DQL', icon: 'filter-list', sql: "SELECT * FROM users\nLIMIT 100;" },
  { title: 'Join Tables', category: 'DQL', icon: 'merge-type', sql: "SELECT u.name, o.product, o.amount\nFROM users u\nINNER JOIN orders o ON o.user_id = u.id\nORDER BY o.created_at DESC;" },
  { title: 'Group & Count', category: 'DQL', icon: 'bar-chart', sql: "SELECT category, COUNT(*) AS total\nFROM orders\nGROUP BY category\nORDER BY total DESC;" },
  { title: 'Insert Row', category: 'DML', icon: 'add-circle-outline', sql: "INSERT INTO users (name, email)\nVALUES ('Alice', 'alice@example.com');" },
  { title: 'Update Rows', category: 'DML', icon: 'edit', sql: "UPDATE users\nSET email = 'new@example.com'\nWHERE id = 1;" },
  { title: 'Delete Rows', category: 'DML', icon: 'delete-outline', sql: "DELETE FROM users\nWHERE created_at < date('now', '-1 year');" },
  { title: 'Create Index', category: 'DDL', icon: 'speed', sql: "CREATE INDEX IF NOT EXISTS idx_users_email\nON users (email);" },
  { title: 'Explain Plan', category: 'Analysis', icon: 'analytics', sql: "EXPLAIN QUERY PLAN\nSELECT * FROM users WHERE email = 'alice@example.com';" },
  { title: 'Integrity Check', category: 'PRAGMA', icon: 'health-and-safety', sql: "PRAGMA integrity_check;\nPRAGMA foreign_key_check;" },
  { title: 'Transaction', category: 'Transaction', icon: 'lock-outline', sql: "BEGIN TRANSACTION;\n\n-- your queries here\n\nCOMMIT;\n-- ROLLBACK; -- to undo" },
];

const CATEGORY_COLORS: Record<string, string> = {
  DDL: '#58A6FF', DQL: '#3FB950', DML: '#FFA657',
  PRAGMA: '#D2A8FF', Schema: '#79C0FF', Analysis: '#F78166', Transaction: '#E3B341',
};

const CATEGORIES = Array.from(new Set(SQL_TEMPLATES.map(t => t.category)));

// ─── NL-to-SQL heuristics (no API key needed) ─────────────────────────────────
function buildHeuristicSql(prompt: string, schema: string): string | null {
  const p = prompt.toLowerCase().trim();

  if (/show|list|what (tables|views)|all tables/.test(p)) {
    return "SELECT name, type FROM sqlite_master\nWHERE type IN ('table','view')\nORDER BY type, name;";
  }
  if (/count.*rows|how many rows|number of rows/.test(p)) {
    const table = p.match(/(?:in|from)\s+(\w+)/)?.[1];
    return table ? `SELECT COUNT(*) AS row_count FROM "${table}";` : "-- Specify table name: SELECT COUNT(*) AS row_count FROM \"your_table\";";
  }
  if (/schema|structure|columns|describe/.test(p)) {
    const table = p.match(/(?:of|for|in|table)\s+(\w+)/)?.[1];
    return table ? `PRAGMA table_info("${table}");` : "-- Specify table: PRAGMA table_info(\"your_table\");";
  }
  if (/select all|show all|get all|fetch all/.test(p)) {
    const table = p.match(/(?:from|in)\s+(\w+)/)?.[1];
    return table ? `SELECT * FROM "${table}"\nLIMIT 100;` : "-- Specify table: SELECT * FROM \"your_table\" LIMIT 100;";
  }
  if (/delete|remove/.test(p)) {
    const table = p.match(/(?:from|in)\s+(\w+)/)?.[1];
    return table ? `-- CAUTION: preview with SELECT first\nDELETE FROM "${table}"\nWHERE id = ?; -- replace ? with actual value` : "-- Specify table and condition for DELETE";
  }
  if (/insert|add/.test(p)) {
    const table = p.match(/(?:into|to)\s+(\w+)/)?.[1];
    return table ? `INSERT INTO "${table}" (col1, col2)\nVALUES (val1, val2);` : "-- Specify table: INSERT INTO \"your_table\" (col) VALUES (val);";
  }
  if (/update|change|modify/.test(p)) {
    const table = p.match(/(?:in|update)\s+(\w+)/)?.[1];
    return table ? `UPDATE "${table}"\nSET column = new_value\nWHERE id = ?; -- replace ? with actual value` : "-- Specify table: UPDATE \"your_table\" SET col = val WHERE id = ?;";
  }
  if (/drop|delete table|remove table/.test(p)) {
    const table = p.match(/(?:table|drop)\s+(\w+)/)?.[1];
    return table ? `-- CAUTION: this permanently drops the table\nDROP TABLE IF EXISTS "${table}";` : "-- Specify table: DROP TABLE IF EXISTS \"your_table\";";
  }
  if (/index/.test(p)) {
    const table = p.match(/(?:on|for)\s+(\w+)/)?.[1];
    const col = p.match(/(?:column|on)\s+\w+\s+(\w+)/)?.[1];
    if (table && col) return `CREATE INDEX IF NOT EXISTS idx_${table}_${col}\nON "${table}" ("${col}");`;
  }
  if (/recent|latest|newest|last/.test(p)) {
    const table = p.match(/(?:from|in)\s+(\w+)/)?.[1];
    const num = p.match(/(\d+)/)?.[1] ?? '10';
    return table
      ? `SELECT * FROM "${table}"\nORDER BY rowid DESC\nLIMIT ${num};`
      : `-- Specify table: SELECT * FROM "your_table" ORDER BY rowid DESC LIMIT ${num};`;
  }
  return null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  isError?: boolean;
}

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setCurrentSql } = useEditor();
  const { activeDbId } = useDatabases();

  const [tab, setTab] = useState<'chat' | 'templates'>('templates');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! Describe what SQL you need and I\'ll generate it for you.\n\nExamples:\n• "Show all tables"\n• "Count rows in users table"\n• "Select latest 10 from orders"\n• "Describe columns of products"',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Template helpers ────────────────────────────────────────────────────────
  const filteredTemplates = SQL_TEMPLATES.filter(t => {
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.sql.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!selectedCategory || t.category === selectedCategory);
  });

  const handleUseTemplate = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/editor');
  };

  // ── AI Chat ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Build schema context from active DB
      let schema = '';
      if (activeDbId) {
        try {
          const { getTables: _getTables } = await import('@/utils/sqliteManager');
          const tables = await _getTables(activeDbId);
          const schemaParts: string[] = [];
          for (const t of tables.filter(t => t.type === 'table').slice(0, 8)) {
            const cols = await getColumns(activeDbId, t.name);
            const colDefs = cols.map(c => `${c.name} ${c.type}${c.pk ? ' PK' : ''}${c.notnull ? ' NOT NULL' : ''}`).join(', ');
            schemaParts.push(`${t.name}(${colDefs})`);
          }
          schema = schemaParts.join('\n');
        } catch (schemaErr) {
          console.warn('[AI] Could not build schema context:', schemaErr);
        }
      }

      // Try heuristic first (offline, instant)
      const heuristicSql = buildHeuristicSql(text, schema);

      if (heuristicSql) {
        const assistantMsg: Message = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: 'Here\'s the SQL for that:',
          sql: heuristicSql,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        // No heuristic match — prompt user to configure AI
        const assistantMsg: Message = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: 'For complex queries, connect an OPENAI_API_KEY in your server environment. For now, try rephrasing or use the Templates tab for common patterns.\n\nTip: Be specific — mention the table name and what you want to do.',
          isError: false,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (e) {
      const errMsg: Message = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${(e as Error).message}`,
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleUseSQL = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/editor');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'SQL Assistant',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }}
      />

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['chat', 'templates'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
          >
            <MaterialIcons
              name={t === 'chat' ? 'chat' : 'library-books'}
              size={16}
              color={tab === t ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === 'chat' ? 'AI Chat' : 'Templates'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Templates tab ── */}
      {tab === 'templates' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search templates..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.searchText, { color: colors.foreground }]}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <MaterialIcons name="close" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.categoryScroll, { borderBottomColor: colors.border }]}
            contentContainerStyle={styles.categoryContent}
          >
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, { backgroundColor: !selectedCategory ? colors.primary : colors.muted, borderColor: !selectedCategory ? colors.primary : colors.border }]}
            >
              <Text style={[styles.categoryText, { color: !selectedCategory ? colors.primaryForeground : colors.mutedForeground }]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                style={[styles.categoryChip, { backgroundColor: selectedCategory === cat ? CATEGORY_COLORS[cat] : colors.muted, borderColor: selectedCategory === cat ? CATEGORY_COLORS[cat] : colors.border }]}
              >
                <Text style={[styles.categoryText, { color: selectedCategory === cat ? '#fff' : colors.mutedForeground }]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
          >
            {filteredTemplates.map(template => (
              <View key={template.title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconBg, { backgroundColor: `${CATEGORY_COLORS[template.category]}20` }]}>
                    <MaterialIcons name={template.icon as any} size={18} color={CATEGORY_COLORS[template.category]} />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{template.title}</Text>
                  <View style={[styles.categoryTag, { backgroundColor: `${CATEGORY_COLORS[template.category]}20` }]}>
                    <Text style={[styles.categoryTagText, { color: CATEGORY_COLORS[template.category] }]}>{template.category}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.sqlPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.sqlText, { color: colors.foreground }]}>{template.sql}</Text>
                </ScrollView>
                <Pressable
                  onPress={() => handleUseTemplate(template.sql)}
                  style={({ pressed }) => [styles.useBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                >
                  <MaterialIcons name="play-arrow" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.useBtnText, { color: colors.primaryForeground }]}>Use in Editor</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Chat tab ── */}
      {tab === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={120}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.chatContent, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(msg => (
              <View
                key={msg.id}
                style={[
                  styles.bubble,
                  msg.role === 'user'
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
                {msg.role === 'assistant' && (
                  <View style={styles.aiAvatar}>
                    <MaterialCommunityIcons name="robot-outline" size={14} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bubbleText, { color: msg.role === 'user' ? colors.primaryForeground : (msg.isError ? colors.destructive : colors.foreground) }]}>
                    {msg.content}
                  </Text>
                  {msg.sql && (
                    <View style={[styles.sqlBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={[styles.sqlBlockText, { color: colors.foreground }]}>{msg.sql}</Text>
                      </ScrollView>
                      <Pressable
                        onPress={() => handleUseSQL(msg.sql!)}
                        style={[styles.useSqlBtn, { backgroundColor: colors.primary }]}
                      >
                        <MaterialIcons name="play-arrow" size={14} color={colors.primaryForeground} />
                        <Text style={[styles.useSqlBtnText, { color: colors.primaryForeground }]}>Use in Editor</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {isLoading && (
              <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.bubbleText, { color: colors.mutedForeground, marginLeft: 8 }]}>Thinking...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input bar */}
          <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom || 16 }]}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe the SQL you need..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.chatInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
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
                styles.sendBtn,
                { backgroundColor: prompt.trim() && !isLoading ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <MaterialIcons name="send" size={18} color={prompt.trim() && !isLoading ? colors.primaryForeground : colors.mutedForeground} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  // Templates
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  searchText: { flex: 1, fontSize: 15 },
  categoryScroll: { maxHeight: 50, borderBottomWidth: 1 },
  categoryContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  categoryText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryTagText: { fontSize: 11, fontWeight: '700' },
  sqlPreview: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 100 },
  sqlText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18 },
  useBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  useBtnText: { fontSize: 14, fontWeight: '700' },
  // Chat
  chatContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  bubble: { flexDirection: 'row', gap: 8, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', borderRadius: 16, padding: 12 },
  aiBubble: { alignSelf: 'flex-start', borderRadius: 16, borderWidth: 1, padding: 12 },
  aiAvatar: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  sqlBlock: { marginTop: 8, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  sqlBlockText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18, padding: 10 },
  useSqlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4 },
  useSqlBtnText: { fontSize: 12, fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  chatInput: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
