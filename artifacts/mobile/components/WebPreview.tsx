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

// ── Python / Pyodide sandbox ──────────────────────────────────────────────────
// Loads Pyodide (CPython via WASM) from CDN. Captures stdout/stderr and
// displays them as styled terminal output. Requires internet on first run.

const PYTHON_SANDBOX_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
__SHIM__
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Menlo','Monaco','Courier New',monospace;font-size:12.5px;line-height:1.65;padding:14px;min-height:100vh}
#o{white-space:pre-wrap;word-break:break-all}
.out{color:#cdd6f4}
.err{color:#f38ba8}
.info{color:#585b70;font-style:italic}
.res{color:#a6e3a1;display:block;margin-top:6px;border-top:1px solid #313244;padding-top:6px}
</style>
</head>
<body>
<div id="o"><span class="info">⏳ Loading Python runtime… (~5 s on first run)</span></div>
<script>
;(function(){
  var CODE=__USER_CODE__;
  var el=document.getElementById('o');
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function append(cls,txt){var n=document.createElement('span');n.className=cls;n.textContent=txt;el.appendChild(n);}

  if(!CODE||!CODE.trim()){
    el.innerHTML='<span class="info">▶ Press Run to execute Python</span>';
    return;
  }

  var _to=setTimeout(function(){
    if(typeof loadPyodide==='undefined'){
      el.innerHTML='<span class="err">⚠️ Python requires an internet connection.\\nPyodide CDN did not load within 15 s.\\nCheck your connection and try again.</span>';
    }
  },15000);

  async function run(){
    clearTimeout(_to);
    el.innerHTML='<span class="info">⏳ Initializing Python…</span>';
    try{
      var py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'});
      var stdout='',stderr='';
      py.setStdout({batched:function(s){stdout+=s+'\\n';}});
      py.setStderr({batched:function(s){stderr+=s+'\\n';}});
      var result;
      try{ result=await py.runPythonAsync(CODE); }
      catch(e){
        var em=e.message||String(e);
        el.innerHTML='<span class="err">'+esc(em)+'</span>';
        if(stdout){append('out','\\n'+stdout);console.log(stdout.trimEnd());}
        console.error(em); return;
      }
      el.innerHTML='';
      if(stdout){append('out',stdout);console.log(stdout.trimEnd());}
      if(stderr){append('err',stderr);console.warn(stderr.trimEnd());}
      if(!stdout&&!stderr){el.innerHTML='<span class="info">✓ Ran successfully — no output</span>';}
      if(result!==null&&result!==undefined){
        var rv=String(result);
        if(rv&&rv!=='undefined'&&rv!=='None'&&rv!=='null'){
          append('res','→ '+rv); console.log('→ '+rv);
        }
      }
    }catch(e){ el.innerHTML='<span class="err">'+esc(e.message||String(e))+'</span>'; console.error(e.message||String(e)); }
  }

  if(typeof loadPyodide!=='undefined'){ run(); }
  else{
    var _sc=document.querySelector('script[src*="pyodide"]');
    if(_sc){ _sc.addEventListener('load',run); }
    else{ el.innerHTML='<span class="err">Pyodide script not found.</span>'; }
  }
})();
</script>
</body>
</html>`;

// ── React JSX sandbox ─────────────────────────────────────────────────────────
// Loads React 18 + Babel Standalone from CDN; transpiles user JSX at runtime.
// Auto-renders whatever component named App (or the last PascalCase function) is defined.

/** Strip import/export module syntax so users can write idiomatic JSX without worrying about globals */
function preprocessReact(code: string): string {
  return code
    // Remove "import React from 'react'" — React is global
    .replace(/^import\s+React(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"];?\s*$/gm, '// (React is available globally)')
    // Remove named imports from react — useState etc. are accessed via React.useState
    .replace(/^import\s+\{[^}]+\}\s+from\s+['"]react['"];?\s*$/gm, '// (use React.useState, React.useEffect, etc.)')
    // Remove other imports silently (they won't resolve in sandbox)
    .replace(/^import\s+.+\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    // export default → just the declaration
    .replace(/^export\s+default\s+/gm, '')
    // export named → just the declaration
    .replace(/^export\s+(?=function|const|class|let|var)/gm, '');
}

const REACT_SANDBOX_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
__SHIM__
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.23.10/babel.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:12px;background:#fafafa;min-height:100vh}
#root{min-height:40px}
.jsx-err{background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;padding:12px 14px;margin:8px 0;font-family:monospace;font-size:12px;color:#dc2626;white-space:pre-wrap;word-break:break-all}
.jsx-info{color:#9ca3af;padding:24px;text-align:center;font-size:13px}
</style>
</head>
<body>
<div id="root"><div class="jsx-info">⏳ Loading React…</div></div>
<script>
;(function(){
  var _code = __USER_CODE__;
  var _attempts = 0;

  function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function _showErr(msg){
    document.getElementById('root').innerHTML='<div class="jsx-err">'+_esc(msg)+'</div>';
    console.error(msg);
  }

  function _autoRender(compiled){
    // eslint-disable-next-line no-new-func
    (new Function(compiled))();
    var r=document.getElementById('root');
    try{
      if(typeof App!=='undefined'){
        ReactDOM.createRoot(r).render(React.createElement(App));
      } else {
        // Find last PascalCase function defined
        var _k=Object.keys(window).filter(function(k){
          return /^[A-Z][A-Za-z0-9]*$/.test(k) && typeof window[k]==='function'
            && k!=='Array'&&k!=='Object'&&k!=='Error'&&k!=='Boolean'&&k!=='Number'&&k!=='String'&&k!=='Function'&&k!=='RegExp'&&k!=='Symbol'&&k!=='Promise'&&k!=='Math'&&k!=='JSON'&&k!=='Date'&&k!=='Map'&&k!=='Set'&&k!=='Reflect'&&k!=='Proxy'&&k!=='Intl'&&k!=='WeakMap'&&k!=='WeakSet'&&k!=='Babel'&&k!=='React'&&k!=='ReactDOM';
        });
        if(_k.length>0){
          ReactDOM.createRoot(r).render(React.createElement(window[_k[_k.length-1]]));
        } else {
          r.innerHTML='<div class="jsx-info">Define a component named <b>App</b> to see it rendered here.</div>';
        }
      }
    }catch(e){
      r.innerHTML='<div class="jsx-err">Runtime error: '+_esc(e&&e.message?e.message:String(e))+'</div>';
      console.error(e&&e.message?e.message:String(e));
    }
  }

  function _run(){
    _attempts++;
    if(typeof Babel==='undefined'||typeof React==='undefined'||typeof ReactDOM==='undefined'){
      if(_attempts>140){
        _showErr('⚠️ React requires an internet connection.\\nBabel / React CDN did not load within 7 s.\\nPlease check your connection and try again.');
        return;
      }
      return setTimeout(_run,50);
    }
    try{
      var compiled=Babel.transform(_code,{presets:['react'],filename:'App.jsx'}).code;
      _autoRender(compiled);
    }catch(e){
      _showErr((e&&e.message?e.message:String(e)).replace(/^.*SyntaxError:/,'🔴 JSX Syntax Error:'));
    }
  }

  _run();
})();
</script>
</body>
</html>`;

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
  if (language === 'react') {
    const processed = preprocessReact(code);
    return REACT_SANDBOX_TEMPLATE
      .replace('__SHIM__', CONSOLE_SHIM)
      .replace('__USER_CODE__', JSON.stringify(processed));
  }

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
