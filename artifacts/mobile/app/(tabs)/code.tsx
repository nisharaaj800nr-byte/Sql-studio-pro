/**
 * Code Editor Screen — Phase 3.2 (HTML), 3.3 (CSS), 3.4 (JS)
 * Live preview with WebView sandbox + Console panel for JS output.
 */
import React, { useCallback, useRef, useState } from 'react';
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
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useCode, type CodeLanguage, type ConsoleEntry } from '@/contexts/CodeContext';
import { WebPreview } from '@/components/WebPreview';
import { ConsolePanel } from '@/components/ConsolePanel';
import { ColorPickerModal } from '@/components/ColorPickerModal';
import { DOMInspector, type DOMNode } from '@/components/DOMInspector';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ── Per-language snippet bars ─────────────────────────────────────────────────

const SNIPPETS: Record<CodeLanguage, Array<{ label: string; text: string }>> = {
  react: [
    { label: 'useState',     text: 'const [value, setValue] = React.useState(initialValue);' },
    { label: 'useEffect',    text: 'React.useEffect(() => {\n  // side effect\n  return () => { /* cleanup */ };\n}, [deps]);' },
    { label: 'fn comp',      text: 'function MyComponent({ prop }) {\n  return (\n    <div>\n      {prop}\n    </div>\n  );\n}' },
    { label: '=> comp',      text: 'const MyComponent = ({ prop }) => (\n  <div>{prop}</div>\n);' },
    { label: 'onClick',      text: 'onClick={() => { }}' },
    { label: 'onChange',     text: 'onChange={e => setValue(e.target.value)}' },
    { label: 'map list',     text: '{items.map((item, i) => (\n  <div key={i}>{item}</div>\n))}' },
    { label: 'ternary',      text: '{condition ? <Yes /> : <No />}' },
    { label: 'style={{',     text: 'style={{ color: "#2563eb", fontSize: 16 }}' },
    { label: 'useRef',       text: 'const ref = React.useRef(null);' },
    { label: 'useMemo',      text: 'const result = React.useMemo(() => compute(a, b), [a, b]);' },
    { label: 'useCallback',  text: 'const fn = React.useCallback(() => { }, [deps]);' },
    { label: 'fragment',     text: 'return (\n  <>\n    <div>First</div>\n    <div>Second</div>\n  </>\n);' },
    { label: '<input>',      text: '<input\n  value={value}\n  onChange={e => setValue(e.target.value)}\n  placeholder=""\n/>' },
    { label: '<button>',     text: '<button\n  onClick={handleClick}\n  style={{ cursor: "pointer" }}\n>\n  Label\n</button>' },
    { label: 'context',      text: 'const Ctx = React.createContext(null);\nfunction useCtx() { return React.useContext(Ctx); }' },
  ],
  html: [
    { label: '<div>',    text: '<div></div>' },
    { label: '<p>',      text: '<p></p>' },
    { label: '<span>',   text: '<span></span>' },
    { label: '<a>',      text: '<a href=""></a>' },
    { label: '<img>',    text: '<img src="" alt="">' },
    { label: '<ul>',     text: '<ul>\n  <li></li>\n  <li></li>\n</ul>' },
    { label: '<ol>',     text: '<ol>\n  <li></li>\n  <li></li>\n</ol>' },
    { label: '<table>',  text: '<table>\n  <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>\n  <tbody><tr><td></td><td></td></tr></tbody>\n</table>' },
    { label: '<form>',   text: '<form>\n  <input type="text" name="" placeholder="">\n  <button type="submit">Submit</button>\n</form>' },
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
    { label: 'animation',  text: 'animation: fadeIn 0.5s ease-in;' },
    { label: 'border-r',   text: 'border-radius: 8px;' },
    { label: 'shadow',     text: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);' },
    { label: 'absolute',   text: 'position: absolute;\ntop: 0;\nleft: 0;\nwidth: 100%;\nheight: 100%;' },
    { label: 'center',     text: 'display: flex;\nalign-items: center;\njustify-content: center;' },
    { label: 'var()',      text: '--color-primary: #2563eb;\ncolor: var(--color-primary);' },
    { label: ':hover',     text: ':hover {\n  \n}' },
    { label: ':focus',     text: ':focus {\n  outline: 2px solid #2563eb;\n  outline-offset: 2px;\n}' },
    { label: 'gradient',   text: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' },
    { label: 'reset',      text: '*, *::before, *::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}' },
  ],
  js: [
    { label: 'const',    text: 'const ' },
    { label: 'let',      text: 'let ' },
    { label: 'fn',       text: 'function name() {\n  \n}' },
    { label: '=>',       text: '(params) => {\n  \n}' },
    { label: 'if',       text: 'if (condition) {\n  \n} else {\n  \n}' },
    { label: 'for',      text: 'for (let i = 0; i < arr.length; i++) {\n  \n}' },
    { label: 'forEach',  text: '.forEach((item) => {\n  \n});' },
    { label: 'map',      text: '.map((item) => item)' },
    { label: 'filter',   text: '.filter((item) => item)' },
    { label: 'async',    text: 'async function name() {\n  try {\n    const res = await fetch(\'\');\n    const data = await res.json();\n  } catch (e) {\n    console.error(e);\n  }\n}' },
    { label: 'fetch',    text: "fetch('')\n  .then(r => r.json())\n  .then(data => console.log(data))\n  .catch(e => console.error(e));" },
    { label: 'log',      text: 'console.log()' },
    { label: 'query',    text: "document.querySelector('')" },
    { label: 'queryAll', text: "document.querySelectorAll('')" },
    { label: 'try',      text: 'try {\n  \n} catch (e) {\n  console.error(e);\n}' },
    { label: 'class',    text: 'class Name {\n  constructor() {\n    \n  }\n}' },
    { label: 'Promise',  text: 'new Promise((resolve, reject) => {\n  \n})' },
  ],
};

// ── Language config ───────────────────────────────────────────────────────────

const LANG_LABELS: Record<CodeLanguage, string> = { html: 'HTML', css: 'CSS', js: 'JavaScript', react: 'React (JSX)' };
const LANG_ICONS:  Record<CodeLanguage, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  html:  'language-html5',
  css:   'language-css3',
  js:    'language-javascript',
  react: 'react',
};
const LANG_COLORS: Record<CodeLanguage, string> = {
  html:  '#e34c26',
  css:   '#264de4',
  js:    '#f0db4f',
  react: '#61dafb',
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CodeScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const {
    tabs, activeTabId, setActiveTabId,
    addTab, closeTab, updateTabCode, activeTab,
  } = useCode();

  const inputRef           = useRef<TextInput>(null);
  const [bottomPanel, setBottomPanel] = useState<'preview' | 'console' | 'dom'>('preview');
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [domTree, setDomTree] = useState<DOMNode | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const language   = activeTab?.language ?? 'html';
  const code       = activeTab?.code ?? '';
  const snippets   = SNIPPETS[language];
  // DOM tab makes sense for HTML, CSS, and React (all render real DOM trees)
  const showDomTab = language === 'html' || language === 'css' || language === 'react';

  const handleCodeChange = useCallback((text: string) => {
    if (activeTab) updateTabCode(activeTab.id, text);
  }, [activeTab, updateTabCode]);

  const insertSnippet = (text: string) => {
    const newCode = code + text;
    handleCodeChange(newCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  const insertColor = (color: string) => {
    handleCodeChange(code + color);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    Alert.alert('Clear Code', 'Delete all code in this tab?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { handleCodeChange(''); inputRef.current?.focus(); } },
    ]);
  };

  const handleAddTab = (lang: CodeLanguage) => {
    addTab(lang);
    setShowAddMenu(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const lineCount = code.split('\n').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map(tab => {
          const isActive  = tab.id === activeTabId;
          const langColor = LANG_COLORS[tab.language];
          return (
            <Pressable
              key={tab.id}
              onPress={() => { setActiveTabId(tab.id); Haptics.selectionAsync(); }}
              style={[styles.tab, isActive && { borderBottomWidth: 2, borderBottomColor: langColor }]}
            >
              <MaterialCommunityIcons name={LANG_ICONS[tab.language]} size={13} color={isActive ? langColor : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: isActive ? colors.foreground : colors.mutedForeground }]}>
                {tab.label}
              </Text>
              {tabs.length > 1 && (
                <Pressable onPress={() => closeTab(tab.id)} hitSlop={6}>
                  <MaterialIcons name="close" size={12} color={colors.mutedForeground} />
                </Pressable>
              )}
            </Pressable>
          );
        })}

        {/* Add tab button */}
        <Pressable onPress={() => setShowAddMenu(v => !v)} style={styles.addTabBtn} hitSlop={8}>
          <MaterialIcons name="add" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>

      {/* Add tab dropdown */}
      {showAddMenu && (
        <View style={[styles.addMenu, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }]}>
          {(['html', 'css', 'js', 'react'] as CodeLanguage[]).map(lang => (
            <Pressable
              key={lang}
              onPress={() => handleAddTab(lang)}
              style={({ pressed }) => [styles.addMenuItem, { backgroundColor: pressed ? colors.muted : 'transparent' }]}
            >
              <MaterialCommunityIcons name={LANG_ICONS[lang]} size={15} color={LANG_COLORS[lang]} />
              <Text style={[styles.addMenuLabel, { color: colors.foreground }]}>New {LANG_LABELS[lang]} tab</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowAddMenu(false)} style={styles.addMenuClose}>
            <Text style={[styles.addMenuCloseText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* ── Editor toolbar ─────────────────────────────────────────────────── */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* Language pill */}
        <View style={[styles.langPill, { backgroundColor: LANG_COLORS[language] + '22' }]}>
          <MaterialCommunityIcons name={LANG_ICONS[language]} size={14} color={LANG_COLORS[language]} />
          <Text style={[styles.langPillText, { color: LANG_COLORS[language] }]}>
            {LANG_LABELS[language]}
          </Text>
        </View>

        {/* Color picker (CSS only) */}
        {language === 'css' && (
          <Pressable onPress={() => setShowColorPicker(true)} style={styles.iconBtn} hitSlop={8}>
            <MaterialIcons name="palette" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}

        <Pressable onPress={handleClear} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="clear-all" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* Word wrap toggle info */}
        <Text style={[styles.lineCount, { color: colors.mutedForeground }]}>{lineCount}L</Text>
      </View>

      {/* ── Code editor (line numbers + TextInput) ─────────────────────────── */}
      <View style={[styles.editorWrapper, { backgroundColor: colors.editorBg }]}>
        <ScrollView style={styles.editorScroll} keyboardDismissMode="none">
          <View style={styles.editorInner}>
            {/* Line numbers */}
            <View style={[styles.lineNums, { backgroundColor: colors.background, borderRightColor: colors.border }]}>
              {Array.from({ length: lineCount }, (_, i) => (
                <Text key={i} style={[styles.lineNum, { color: colors.editorLineNumber }]}>
                  {i + 1}
                </Text>
              ))}
            </View>
            {/* Input */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              style={[styles.codeInput, { color: colors.editorText }]}
              multiline
              scrollEnabled={false}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              keyboardType="ascii-capable"
              selectionColor={colors.editorCaret}
              placeholder={language === 'react' ? `// Write React JSX here — define a function App() { return <div>...</div>; }` : `<!-- Write ${LANG_LABELS[language]} here... -->`}
              placeholderTextColor={colors.editorLineNumber}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>

      {/* ── Snippet bar ─────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.snippetBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}
        contentContainerStyle={styles.snippetBarContent}
        keyboardShouldPersistTaps="always"
      >
        {snippets.map(s => (
          <Pressable
            key={s.label}
            onPress={() => insertSnippet(s.text)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.chipText, { fontFamily: MONO_FONT, color: LANG_COLORS[language] }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Divider with panel toggle ──────────────────────────────────────── */}
      <View style={[styles.divider, { backgroundColor: colors.border }]}>
        <View style={[styles.panelToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setBottomPanel('preview')}
            style={[styles.toggleBtn, bottomPanel === 'preview' && { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="visibility" size={13} color={bottomPanel === 'preview' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: bottomPanel === 'preview' ? colors.primaryForeground : colors.mutedForeground }]}>
              Preview
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBottomPanel('console')}
            style={[styles.toggleBtn, bottomPanel === 'console' && { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="terminal" size={13} color={bottomPanel === 'console' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: bottomPanel === 'console' ? colors.primaryForeground : colors.mutedForeground }]}>
              Console
            </Text>
            {consoleEntries.filter(e => e.type === 'error').length > 0 && (
              <View style={[styles.errorDot, { backgroundColor: colors.destructive }]} />
            )}
          </Pressable>
          {/* DOM Inspector — only for HTML and CSS */}
          {showDomTab && (
            <Pressable
              onPress={() => setBottomPanel('dom')}
              style={[styles.toggleBtn, bottomPanel === 'dom' && { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="developer-mode" size={13} color={bottomPanel === 'dom' ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: bottomPanel === 'dom' ? colors.primaryForeground : colors.mutedForeground }]}>
                DOM
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Bottom panel ──────────────────────────────────────────────────── */}
      <View style={styles.bottomPanel}>
        {/* WebPreview is always mounted to avoid re-render flicker on toggle */}
        <View style={{ flex: 1, display: bottomPanel === 'preview' ? 'flex' : 'none' }}>
          <WebPreview
            language={language}
            code={code}
            onConsoleEntries={setConsoleEntries}
            onDomTree={setDomTree}
          />
        </View>
        {bottomPanel === 'console' && (
          <ConsolePanel
            entries={consoleEntries}
            onClear={() => setConsoleEntries([])}
          />
        )}
        {bottomPanel === 'dom' && (
          <DOMInspector tree={domTree} />
        )}
      </View>

      {Platform.OS === 'web' && <View style={{ height: 34 }} />}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <ColorPickerModal
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onPick={insertColor}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1 },
  tabBar:         { borderBottomWidth: 1, maxHeight: 40, flexGrow: 0 },
  tabBarContent:  { paddingHorizontal: 4, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 10, marginRight: 2,
  },
  tabLabel:    { fontSize: 12, fontWeight: '600' },
  addTabBtn:   { padding: 8 },
  addMenu: {
    position: 'absolute', top: 40, right: 8, zIndex: 100,
    borderRadius: 10, borderWidth: 1, overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    minWidth: 180,
  },
  addMenuItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  addMenuLabel:     { fontSize: 14, fontWeight: '500' },
  addMenuClose:     { padding: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  addMenuCloseText: { fontSize: 13 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 6, borderBottomWidth: 1, gap: 6,
  },
  langPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  langPillText: { fontSize: 12, fontWeight: '700', flex: 1 },
  iconBtn:      { padding: 6 },
  lineCount:    { marginLeft: 'auto', fontSize: 11, fontFamily: MONO_FONT },
  editorWrapper:{ flex: 1 },
  editorScroll: { flex: 1 },
  editorInner:  { flexDirection: 'row', minHeight: '100%', paddingBottom: 20 },
  lineNums: {
    paddingTop: 14, paddingHorizontal: 8,
    minWidth: 42, alignItems: 'flex-end', borderRightWidth: 1,
  },
  lineNum:     { fontFamily: MONO_FONT, fontSize: 12, lineHeight: 19.2, color: '#585B70', minWidth: 20, textAlign: 'right' },
  codeInput:   { flex: 1, paddingHorizontal: 14, paddingTop: 14, fontFamily: MONO_FONT, fontSize: 13, lineHeight: 19.2, textAlignVertical: 'top' },
  snippetBar:          { borderTopWidth: 1, maxHeight: 40, flexGrow: 0 },
  snippetBarContent:   { paddingHorizontal: 8, paddingVertical: 5, gap: 6, alignItems: 'center' },
  chip:                { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText:            { fontSize: 11, fontWeight: '600' },
  divider: {
    height: 2, alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  panelToggle: {
    flexDirection: 'row', borderRadius: 8, borderWidth: 1, overflow: 'hidden',
    position: 'absolute', zIndex: 1,
  },
  toggleBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5 },
  toggleText: { fontSize: 11, fontWeight: '600' },
  errorDot:   { width: 6, height: 6, borderRadius: 3 },
  bottomPanel:{ flex: 1 },
});
