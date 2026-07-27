/**
 * Code Editor Screen — Premium redesign matching reference image exactly.
 * Layout: Header → File tabs → Syntax-highlighted editor → Code/Preview/Output
 * switcher → Live preview card.
 * All colors sourced from useColors() — fully theme-aware.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useCode, type CodeLanguage, type ConsoleEntry } from '@/contexts/CodeContext';
import { WebPreview } from '@/components/WebPreview';
import { ConsolePanel } from '@/components/ConsolePanel';
import { useColors } from '@/hooks/useColors';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ── Per-language config ───────────────────────────────────────────────────────
const LANG_COLOR: Record<CodeLanguage, string> = {
  html: '#E44D26', css: '#264DE4', js: '#F0DB4F',
  react: '#61DAFB', python: '#3776AB',
};
const LANG_ICON: Record<CodeLanguage, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  html: 'language-html5', css: 'language-css3', js: 'language-javascript',
  react: 'react', python: 'language-python',
};
const LANG_FILE: Record<CodeLanguage, string> = {
  html: 'index.html', css: 'styles.css', js: 'script.js',
  react: 'App.jsx', python: 'main.py',
};
const LANG_LABEL: Record<CodeLanguage, string> = {
  html: 'HTML', css: 'CSS', js: 'JavaScript', react: 'React', python: 'Python',
};

// ── Snippet bars ──────────────────────────────────────────────────────────────
const SNIPPETS: Record<CodeLanguage, Array<{ label: string; text: string }>> = {
  html: [
    { label: '<div>',    text: '<div></div>' },
    { label: '<p>',      text: '<p></p>' },
    { label: '<span>',   text: '<span></span>' },
    { label: '<a>',      text: '<a href=""></a>' },
    { label: '<img>',    text: '<img src="" alt="">' },
    { label: '<ul>',     text: '<ul>\n  <li></li>\n</ul>' },
    { label: '<form>',   text: '<form>\n  <input type="text">\n  <button type="submit">Submit</button>\n</form>' },
    { label: '<input>',  text: '<input type="text" placeholder="">' },
    { label: '<button>', text: '<button onclick=""></button>' },
    { label: '<style>',  text: '<style>\n  \n</style>' },
    { label: '<script>', text: '<script>\n  \n</script>' },
    { label: '<h1>',     text: '<h1></h1>' },
    { label: '<section>',text: '<section>\n  \n</section>' },
  ],
  css: [
    { label: 'flex',       text: 'display: flex;\nalign-items: center;\njustify-content: center;' },
    { label: 'grid',       text: 'display: grid;\ngrid-template-columns: repeat(3, 1fr);\ngap: 16px;' },
    { label: '@media',     text: '@media (max-width: 768px) {\n  \n}' },
    { label: 'transition', text: 'transition: all 0.3s ease;' },
    { label: 'border-r',   text: 'border-radius: 8px;' },
    { label: 'shadow',     text: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);' },
    { label: 'gradient',   text: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' },
    { label: ':hover',     text: ':hover {\n  \n}' },
    { label: 'var()',      text: '--color: #2563eb;\ncolor: var(--color);' },
  ],
  js: [
    { label: 'const',   text: 'const ' }, { label: 'let',    text: 'let ' },
    { label: 'fn',      text: 'function name() {\n  \n}' },
    { label: '=>',      text: '(params) => {\n  \n}' },
    { label: 'if',      text: 'if (condition) {\n  \n}' },
    { label: 'for',     text: 'for (let i = 0; i < arr.length; i++) {\n  \n}' },
    { label: 'forEach', text: '.forEach((item) => {\n  \n});' },
    { label: 'async',   text: 'async function name() {\n  const res = await fetch(\'\');\n  const data = await res.json();\n}' },
    { label: 'log',     text: 'console.log()' },
    { label: 'query',   text: "document.querySelector('')" },
  ],
  react: [
    { label: 'useState',  text: 'const [value, setValue] = React.useState(initialValue);' },
    { label: 'useEffect', text: 'React.useEffect(() => {\n  \n  return () => { };\n}, []);' },
    { label: 'fn comp',   text: 'function MyComponent({ prop }) {\n  return (\n    <div>{prop}</div>\n  );\n}' },
    { label: 'onClick',   text: 'onClick={() => { }}' },
    { label: 'map list',  text: '{items.map((item, i) => (\n  <div key={i}>{item}</div>\n))}' },
  ],
  python: [
    { label: 'print',  text: 'print()' }, { label: 'def', text: 'def name():\n    ' },
    { label: 'class',  text: 'class Name:\n    def __init__(self):\n        ' },
    { label: 'if',     text: 'if condition:\n    ' },
    { label: 'for',    text: 'for item in items:\n    ' },
    { label: 'import', text: 'import ' },
    { label: 'try',    text: 'try:\n    \nexcept Exception as e:\n    print(e)' },
    { label: 'list',   text: '[item for item in iterable]' },
    { label: 'lambda', text: 'lambda x: x' },
  ],
};

// ── HTML tokenizer ────────────────────────────────────────────────────────────
type TokType = 'comment' | 'doctype' | 'tag_open' | 'tag_close' | 'text';
type Tok = { type: TokType; value: string };

function tokenizeHTML(code: string): Tok[] {
  const out: Tok[] = [];
  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/[a-zA-Z][^>]*>|<[a-zA-Z!][^>]*\/?>|[^<]+|<(?!\/)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const v = m[0];
    if (v.startsWith('<!--')) out.push({ type: 'comment', value: v });
    else if (/^<!DOCTYPE/i.test(v)) out.push({ type: 'doctype', value: v });
    else if (v.startsWith('</')) out.push({ type: 'tag_close', value: v });
    else if (v.startsWith('<')) out.push({ type: 'tag_open', value: v });
    else out.push({ type: 'text', value: v });
  }
  return out;
}

type SubTok = { kind: 'bracket' | 'tagname' | 'attrname' | 'attrval' | 'ws'; text: string };
function parseOpenTag(tag: string): SubTok[] {
  const result: SubTok[] = [];
  const inner = tag.startsWith('<') ? tag.slice(1) : tag;
  const isSelfClose = inner.endsWith('/>');
  const body = inner.endsWith('>') ? inner.slice(0, -1) : inner;
  const selfSlash = isSelfClose ? '/' : '';
  result.push({ kind: 'bracket', text: '<' });
  const nameMatch = body.match(/^([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*)$/);
  if (!nameMatch) {
    result.push({ kind: 'tagname', text: body });
    result.push({ kind: 'bracket', text: (selfSlash ? '/>' : '>') });
    return result;
  }
  result.push({ kind: 'tagname', text: nameMatch[1] });
  let rest = nameMatch[2];
  const attrRe = /(\s+)([a-zA-Z:_][a-zA-Z0-9:_.-]*)(?:(=)(?:"([^"]*)"?|'([^']*)'?|(\S+)))?/g;
  let am: RegExpExecArray | null;
  let lastIndex = 0;
  while ((am = attrRe.exec(rest)) !== null) {
    if (am.index > lastIndex) result.push({ kind: 'ws', text: rest.slice(lastIndex, am.index) });
    result.push({ kind: 'ws', text: am[1] });
    result.push({ kind: 'attrname', text: am[2] });
    if (am[3]) {
      result.push({ kind: 'bracket', text: '=' });
      const val = am[4] !== undefined ? `"${am[4]}"` : am[5] !== undefined ? `'${am[5]}'` : am[6] ?? '';
      result.push({ kind: 'attrval', text: val });
    }
    lastIndex = am.index + am[0].length;
  }
  if (lastIndex < rest.length) result.push({ kind: 'ws', text: rest.slice(lastIndex) });
  result.push({ kind: 'bracket', text: (selfSlash ? '/>' : '>') });
  return result;
}

// Syntax color palettes — dark (VS Code Dark+) and light (VS Code Light+)
const SYN_DARK = {
  bracket:  '#7D8590',
  tagname:  '#F47067',
  doctype:  '#569CD6',
  comment:  '#6A9955',
  attrname: '#9CDCFE',
  attrval:  '#CE9178',
  text:     '#D4D4D4',
};
const SYN_LIGHT = {
  bracket:  '#666666',
  tagname:  '#800000',
  doctype:  '#1C5AAB',
  comment:  '#008000',
  attrname: '#C25E00',
  attrval:  '#1565C0',
  text:     '#374151',
};

function HighlightedHTML({ code }: { code: string }) {
  const c = useColors();
  const SYN = c.isDark ? SYN_DARK : SYN_LIGHT;
  const tokens = useMemo(() => tokenizeHTML(code), [code]);
  return (
    <Text style={hl.wrap} selectable={false} allowFontScaling={false}>
      {tokens.map((tok, ti) => {
        if (tok.type === 'comment') return <Text key={ti} style={{ color: SYN.comment }}>{tok.value}</Text>;
        if (tok.type === 'doctype') return (
          <Text key={ti}>
            <Text style={{ color: SYN.bracket }}>{'<!'}</Text>
            <Text style={{ color: SYN.doctype }}>{tok.value.slice(2, -1)}</Text>
            <Text style={{ color: SYN.bracket }}>{'>'}</Text>
          </Text>
        );
        if (tok.type === 'tag_close') {
          const inner = tok.value.slice(2, -1);
          return (
            <Text key={ti}>
              <Text style={{ color: SYN.bracket }}>{'</'}</Text>
              <Text style={{ color: SYN.tagname }}>{inner}</Text>
              <Text style={{ color: SYN.bracket }}>{'>'}</Text>
            </Text>
          );
        }
        if (tok.type === 'tag_open') {
          const sub = parseOpenTag(tok.value);
          return (
            <Text key={ti}>
              {sub.map((s, si) => (
                <Text key={si} style={{ color: SYN[s.kind as keyof typeof SYN] ?? SYN.text }}>{s.text}</Text>
              ))}
            </Text>
          );
        }
        return <Text key={ti} style={{ color: SYN.text }}>{tok.value}</Text>;
      })}
    </Text>
  );
}

const hl = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    fontFamily: MONO, fontSize: 13, lineHeight: 20,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 20,
  },
});

// ── Header ────────────────────────────────────────────────────────────────────
function CodeHeader({ language }: { language: CodeLanguage; onMenu?: () => void }) {
  const c = useColors();
  const langColor = LANG_COLOR[language];
  return (
    <View style={[hdr.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <View style={[hdr.langPill, { backgroundColor: langColor + '22' }]}>
        <MaterialCommunityIcons name={LANG_ICON[language]} size={16} color={langColor} />
        <Text style={[hdr.langText, { color: langColor }]}>{LANG_LABEL[language]}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable hitSlop={8} style={hdr.iconBtn}>
        <Ionicons name="moon-outline" size={18} color={c.mutedForeground} />
      </Pressable>
      <Pressable hitSlop={8} style={hdr.iconBtn}>
        <Ionicons name="grid-outline" size={18} color={c.mutedForeground} />
      </Pressable>
      <Pressable hitSlop={8} style={hdr.iconBtn}>
        <Ionicons name="ellipsis-vertical" size={18} color={c.mutedForeground} />
      </Pressable>
    </View>
  );
}

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, gap: 6,
  },
  langPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  langText: { fontSize: 13, fontWeight: '700' },
  iconBtn: { padding: 6 },
});

// ── File tab bar ──────────────────────────────────────────────────────────────
function FileTabBar({
  tabs, activeTabId, onSelect, onClose, onAdd,
}: {
  tabs: { id: string; language: CodeLanguage; label: string }[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}) {
  const c = useColors();
  return (
    <View style={[ftb.container, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={ftb.scroll}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const lc = LANG_COLOR[tab.language];
          return (
            <Pressable
              key={tab.id}
              onPress={() => { onSelect(tab.id); Haptics.selectionAsync(); }}
              style={[ftb.tab, isActive && { borderBottomColor: lc, borderBottomWidth: 2 }]}
            >
              <MaterialCommunityIcons name={LANG_ICON[tab.language]} size={13} color={isActive ? lc : c.mutedForeground} />
              <Text style={[ftb.tabLabel, { color: isActive ? c.foreground : c.mutedForeground }]}>
                {LANG_FILE[tab.language]}
              </Text>
              {tabs.length > 1 && (
                <Pressable onPress={() => onClose(tab.id)} hitSlop={6}>
                  <Ionicons name="close" size={12} color={c.mutedForeground} />
                </Pressable>
              )}
            </Pressable>
          );
        })}
        <Pressable onPress={onAdd} hitSlop={8} style={ftb.addBtn}>
          <Ionicons name="add" size={18} color={c.mutedForeground} />
        </Pressable>
      </ScrollView>
      <View style={ftb.liveWrap}>
        <View style={ftb.liveDot} />
        <Text style={ftb.liveText}>Live</Text>
      </View>
    </View>
  );
}

const ftb = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, height: 42 },
  scroll: { alignItems: 'center', paddingHorizontal: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, height: 42, marginRight: 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  addBtn: { padding: 10 },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' },
  liveText: { fontSize: 12, fontWeight: '600', color: '#22C55E' },
});

// ── Code / Preview / Output switcher ─────────────────────────────────────────
type Panel = 'code' | 'preview' | 'output';

function PanelSwitcher({ active, onChange }: { active: Panel; onChange: (p: Panel) => void }) {
  const c = useColors();
  const items: Array<{ key: Panel; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = [
    { key: 'code',    icon: 'code-slash',      label: 'Code' },
    { key: 'preview', icon: 'desktop-outline', label: 'Preview' },
    { key: 'output',  icon: 'share-outline',   label: 'Output' },
  ];
  return (
    <View style={[sw.bar, { backgroundColor: c.card, borderTopColor: c.border }]}>
      {items.map(item => {
        const isActive = item.key === active;
        return (
          <Pressable key={item.key} onPress={() => { onChange(item.key); Haptics.selectionAsync(); }} style={sw.btnWrap}>
            {isActive ? (
              <LinearGradient colors={['#3B6FF0', '#4B7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sw.activePill}>
                <Ionicons name={item.icon} size={13} color="#FFFFFF" />
                <Text style={sw.activeLabel}>{item.label}</Text>
              </LinearGradient>
            ) : (
              <View style={sw.inactiveWrap}>
                <Ionicons name={item.icon} size={13} color={c.mutedForeground} />
                <Text style={[sw.inactiveLabel, { color: c.mutedForeground }]}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const sw = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 7, paddingHorizontal: 8, gap: 4 },
  btnWrap: { flex: 1 },
  activePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, paddingVertical: 7 },
  activeLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  inactiveWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7 },
  inactiveLabel: { fontSize: 13, fontWeight: '500' },
});

// ── Snippet bar ───────────────────────────────────────────────────────────────
function SnippetBar({ language, onInsert }: { language: CodeLanguage; onInsert: (text: string) => void }) {
  const c = useColors();
  const snippets = SNIPPETS[language];
  const lc = LANG_COLOR[language];
  return (
    <ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      style={[snp.bar, { borderTopColor: c.border, backgroundColor: c.background }]}
      contentContainerStyle={snp.content}
      keyboardShouldPersistTaps="always"
    >
      {snippets.map(s => (
        <Pressable
          key={s.label}
          onPress={() => onInsert(s.text)}
          style={({ pressed }) => [snp.chip, { opacity: pressed ? 0.65 : 1, backgroundColor: c.muted, borderColor: c.border }]}
        >
          <Text style={[snp.chipText, { color: lc }]}>{s.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const snp = StyleSheet.create({
  bar: { borderTopWidth: 1, maxHeight: 38, flexGrow: 0 },
  content: { paddingHorizontal: 8, paddingVertical: 5, gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600', fontFamily: MONO },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CodeScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { tabs, activeTabId, setActiveTabId, addTab, closeTab, updateTabCode, activeTab } = useCode();

  const inputRef = useRef<TextInput>(null);
  const [panel, setPanel] = useState<Panel>('code');
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const language = activeTab?.language ?? 'html';
  const code     = activeTab?.code ?? '';

  const handleCodeChange = useCallback((text: string) => {
    if (activeTab) updateTabCode(activeTab.id, text);
  }, [activeTab, updateTabCode]);

  const insertSnippet = (text: string) => {
    handleCodeChange(code + text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    Alert.alert('Clear Code', 'Delete all code in this tab?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { handleCodeChange(''); inputRef.current?.focus(); } },
    ]);
  };

  const lineCount = code.split('\n').length;
  const useHighlight = language === 'html';

  return (
    <View style={[s.container, { backgroundColor: c.background, paddingTop: insets.top }]}>

      {/* Header */}
      <CodeHeader language={language} />

      {/* File tabs */}
      <FileTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={id => { setActiveTabId(id); }}
        onClose={id => closeTab(id)}
        onAdd={() => setShowAddMenu(v => !v)}
      />

      {/* Add tab dropdown */}
      {showAddMenu && (
        <View style={[s.addMenu, { backgroundColor: c.card, borderColor: c.border }]}>
          {(['html', 'css', 'js', 'react'] as CodeLanguage[]).map(lang => (
            <Pressable
              key={lang}
              onPress={() => { addTab(lang); setShowAddMenu(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={({ pressed }) => [s.addItem, { backgroundColor: pressed ? c.muted : 'transparent' }]}
            >
              <MaterialCommunityIcons name={LANG_ICON[lang]} size={14} color={LANG_COLOR[lang]} />
              <Text style={[s.addItemLabel, { color: c.foreground }]}>New {LANG_LABEL[lang]} file</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowAddMenu(false)} style={[s.addCancel, { borderTopColor: c.border }]}>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* Code editor */}
      <View style={s.editorSection}>
        <ScrollView
          style={[s.editorScroll, { backgroundColor: c.background }]}
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={true}
          indicatorStyle={c.isDark ? 'white' : 'black'}
        >
          <View style={s.editorInner}>
            {/* Line numbers */}
            <View style={[s.lineNums, { backgroundColor: c.card, borderRightColor: c.border }]}>
              {Array.from({ length: lineCount }, (_, i) => (
                <Text key={i} style={[s.lineNum, { color: c.mutedForeground }]}>{i + 1}</Text>
              ))}
            </View>

            {/* Code area: highlighted overlay + transparent input */}
            <View style={{ flex: 1, position: 'relative' }}>
              {useHighlight && <HighlightedHTML code={code} />}
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={handleCodeChange}
                style={[
                  s.codeInput,
                  useHighlight
                    ? { color: 'transparent', caretColor: c.primary } as any
                    : { color: c.foreground },
                ]}
                multiline
                scrollEnabled={false}
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                keyboardType="ascii-capable"
                selectionColor={c.primary}
                textAlignVertical="top"
                placeholder={`<!-- Write ${LANG_LABEL[language]} here... -->`}
                placeholderTextColor={c.mutedForeground}
              />
            </View>
          </View>
        </ScrollView>
        <SnippetBar language={language} onInsert={insertSnippet} />
      </View>

      {/* Code/Preview/Output switcher */}
      <PanelSwitcher active={panel} onChange={setPanel} />

      {/* Bottom panel */}
      <View style={[s.previewSection, { backgroundColor: c.muted }]}>
        {panel === 'code' ? (
          <View style={{ flex: 1 }}>
            <WebPreview language={language} code={code} onConsoleEntries={setConsoleEntries} onDomTree={() => {}} />
          </View>
        ) : panel === 'preview' ? (
          <View style={{ flex: 1 }}>
            <WebPreview language={language} code={code} onConsoleEntries={setConsoleEntries} onDomTree={() => {}} />
          </View>
        ) : (
          <ConsolePanel entries={consoleEntries} onClear={() => setConsoleEntries([])} />
        )}
      </View>

      {Platform.OS === 'web' && <View style={{ height: 34 }} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  editorSection: { flex: 1.1, borderBottomWidth: 0 },
  editorScroll: { flex: 1 },
  editorInner: { flexDirection: 'row', minHeight: '100%', paddingBottom: 20 },
  lineNums: {
    paddingTop: 12, paddingHorizontal: 8,
    minWidth: 40, alignItems: 'flex-end', borderRightWidth: 1,
  },
  lineNum: { fontFamily: MONO, fontSize: 12, lineHeight: 20, minWidth: 18, textAlign: 'right' },
  codeInput: {
    flex: 1, paddingHorizontal: 14, paddingTop: 12,
    fontFamily: MONO, fontSize: 13, lineHeight: 20, textAlignVertical: 'top',
  },
  previewSection: { flex: 1 },
  addMenu: {
    position: 'absolute', top: 88, right: 8, zIndex: 100,
    borderRadius: 12, borderWidth: 1, minWidth: 190, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  addItemLabel: { fontSize: 14, fontWeight: '500' },
  addCancel: { padding: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
});
