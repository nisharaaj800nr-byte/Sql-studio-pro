/**
 * WebPreview — Phase 3.2–3.4
 * Sandboxed WebView that renders HTML / CSS / JS code with live preview.
 * Console messages are intercepted and sent back via postMessage.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import type { CodeLanguage, ConsoleEntry } from '@/contexts/CodeContext';
import type { DOMNode } from '@/components/DOMInspector';

// ── Console interceptor + DOM serializer injected into every sandbox ──────────

const CONSOLE_SHIM = `<script>
(function(){
  var _rn = window.ReactNativeWebView;
  var _send = function(type, args){
    try {
      _rn && _rn.postMessage(JSON.stringify({
        type: type,
        args: Array.prototype.map.call(args, function(a){
          try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
          catch(e){ return String(a); }
        })
      }));
    } catch(e){}
  };
  ['log','warn','error','info'].forEach(function(t){
    var orig = console[t];
    console[t] = function(){ _send(t, arguments); try{ orig && orig.apply(console, arguments); }catch(e){} };
  });
  window.onerror = function(msg, src, line, col){
    _send('error', [msg + ' (line ' + line + ':' + col + ')']);
    return false;
  };
  window.addEventListener('unhandledrejection', function(e){
    _send('error', [String(e.reason)]);
  });

  // ── DOM serializer ────────────────────────────────────────────────────────
  function _serializeNode(node, depth) {
    if (depth > 8) return null;
    if (node.nodeType === 3) {
      var t = (node.textContent || '').trim();
      return t ? { tag: '#text', attrs: {}, children: [], text: t.slice(0, 80) } : null;
    }
    if (node.nodeType !== 1) return null;
    var attrs = {};
    var attrNodes = node.attributes;
    for (var i = 0; i < attrNodes.length; i++) {
      attrs[attrNodes[i].name] = attrNodes[i].value.slice(0, 120);
    }
    var children = [];
    var childNodes = node.childNodes;
    for (var j = 0; j < childNodes.length && children.length < 30; j++) {
      var child = _serializeNode(childNodes[j], depth + 1);
      if (child) children.push(child);
    }
    return { tag: node.tagName.toLowerCase(), attrs: attrs, children: children };
  }

  function _sendDOM() {
    try {
      var tree = _serializeNode(document.documentElement, 0);
      _rn && _rn.postMessage(JSON.stringify({ type: 'dom', tree: tree }));
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _sendDOM);
  } else {
    setTimeout(_sendDOM, 100);
  }
})();
</script>`;

// ── CSS scaffold — sample HTML that CSS is applied to ────────────────────────

const CSS_SCAFFOLD_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
__SHIM__
<style>
*, *::before, *::after { box-sizing: border-box; }
__USER_CSS__
</style>
</head>
<body>
<div class="card">
  <h1>CSS Preview</h1>
  <p>Edit the CSS on the left to style this page.</p>
  <button>Primary button</button>
  <input type="text" placeholder="Text input" style="display:block;margin-top:10px">
  <ul><li>List item one</li><li>List item two</li><li>List item three</li></ul>
  <a href="#">A hyperlink</a>
</div>
</body>
</html>`;

// ── Sandbox builder ───────────────────────────────────────────────────────────

function buildSandbox(language: CodeLanguage, code: string): string {
  if (language === 'html') {
    // Inject console shim into existing <head>, or wrap bare HTML
    if (/<head[^>]*>/i.test(code)) {
      return code.replace(/(<head[^>]*>)/i, `$1\n${CONSOLE_SHIM}`);
    }
    return `<!DOCTYPE html><html><head>${CONSOLE_SHIM}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${code}</body></html>`;
  }

  if (language === 'css') {
    return CSS_SCAFFOLD_TEMPLATE
      .replace('__SHIM__', CONSOLE_SHIM)
      .replace('__USER_CSS__', code);
  }

  // JS sandbox
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CONSOLE_SHIM}
<style>body{font-family:system-ui,sans-serif;padding:12px;margin:0;background:#fafafa;}</style>
</head>
<body>
<script>
(function(){
  try {
    ${code}
  } catch(e) {
    console.error(e && e.message ? e.message + (e.stack ? '\\n' + e.stack.split('\\n').slice(1,3).join('\\n') : '') : String(e));
  }
})();
</script>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WebPreviewProps {
  language: CodeLanguage;
  code: string;
  onConsoleEntries: (entries: ConsoleEntry[]) => void;
  onDomTree?: (tree: DOMNode | null) => void;
}

export function WebPreview({ language, code, onConsoleEntries, onDomTree }: WebPreviewProps) {
  const colors = useColors();
  const [html, setHtml] = useState(() => buildSandbox(language, code));
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesRef  = useRef<ConsoleEntry[]>([]);
  const keyRef      = useRef(0); // force WebView remount on language change

  // Rebuild sandbox with 500 ms debounce when code or language changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRefreshing(true);
    debounceRef.current = setTimeout(() => {
      entriesRef.current = [];
      onConsoleEntries([]);
      onDomTree?.(null);          // clear stale tree while refreshing
      keyRef.current += 1;
      setHtml(buildSandbox(language, code));
      setRefreshing(false);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [language, code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; args?: string[]; tree?: DOMNode };
      if (!data.type) return;

      // DOM tree message
      if (data.type === 'dom') {
        onDomTree?.(data.tree ?? null);
        return;
      }

      // Console message
      if (!Array.isArray(data.args)) return;
      const entry: ConsoleEntry = {
        id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        type: data.type as ConsoleEntry['type'],
        args: data.args,
        timestamp: Date.now(),
      };
      const updated = [...entriesRef.current, entry];
      entriesRef.current = updated;
      onConsoleEntries(updated);
    } catch { /* ignore malformed messages */ }
  };

  if (Platform.OS === 'web') {
    // On Expo web, use a plain iframe via dangerouslySetInnerHTML workaround
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <WebViewWeb html={html} onMessage={handleMessage} />
        {refreshing && <RefreshOverlay color={colors.primary} />}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <WebView
        key={keyRef.current}
        source={{ html, baseUrl: '' }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        scrollEnabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
      {refreshing && <RefreshOverlay color={colors.primary} />}
    </View>
  );
}

// Expo web fallback — render HTML in an iframe
function WebViewWeb({ html, onMessage }: { html: string; onMessage: (e: WebViewMessageEvent) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iframeRef = useRef<any>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type && data.args) {
          onMessage({ nativeEvent: { data: e.data } } as WebViewMessageEvent);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
      title="preview"
    />
  );
}

function RefreshOverlay({ color }: { color: string }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <ActivityIndicator size="small" color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview:   { flex: 1, backgroundColor: 'transparent' },
  overlay:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
});
