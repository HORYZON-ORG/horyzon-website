import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(file, 'utf8');
const source = read('src/components/patrimonial-theme-frame.tsx');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function mount({ query = '', saved = null, storageDenied = false } = {}) {
  const values = new Map(saved === null ? [] : [['hy-patrimonial-theme', saved]]);
  const state = { href: `https://example.invalid/evento${query}`, notices: 0, serverTheme: null };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports, URL, URLSearchParams,
    window: {
      get location() { return { href: state.href, search: new URL(state.href).search }; },
      localStorage: {
        getItem(key) { if (storageDenied) throw Error('denied'); return values.get(key) ?? null; },
        setItem(key, value) { if (storageDenied) throw Error('denied'); values.set(key, value); },
      },
      history: { state: null, replaceState(_state, _title, url) { state.href = String(url); } },
    },
    require(name) {
      if (name === 'react') return { useSyncExternalStore(subscribe, snapshot, server) {
        state.serverTheme = server();
        subscribe(() => state.notices++);
        return snapshot();
      } };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('.css')) return { default: {} };
      throw Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(compiled, context, { timeout: 1000 });
  const render = () => exports.PatrimonialThemeFrame({ children: 'landing' });
  const buttons = node => {
    if (!node || typeof node !== 'object') return [];
    const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
    return [...(node.type === 'button' ? [node] : []), ...children.flatMap(buttons)];
  };
  return { state, values, render, choose(index) { buttons(render())[index].props.onClick(); }, buttons };
}
for (const [options, expected] of [
  [{}, 'dark'], [{ saved: 'light' }, 'light'],
  [{ query: '?tema=chiaro', saved: 'dark' }, 'light'],
  [{ query: '?tema=scuro', saved: 'light' }, 'dark'],
  [{ query: '?tema=invalid', saved: 'light' }, 'light'],
  [{ saved: 'invalid' }, 'dark'], [{ storageDenied: true }, 'dark'],
]) {
  const app = mount(options);
  assert.equal(app.render().props['data-theme'], expected);
  assert.equal(app.state.serverTheme, 'dark', 'SSR snapshot remains deterministic');
  const controls = app.buttons(app.render());
  assert.equal(controls.length, 2);
  assert.equal(controls[expected === 'dark' ? 0 : 1].props['aria-pressed'], true);
  app.choose(expected === 'dark' ? 1 : 0);
  const next = expected === 'dark' ? 'light' : 'dark';
  assert.equal(app.render().props['data-theme'], next, 'Toggle changes the displayed theme');
  assert(app.state.notices > 0, 'Theme subscribers are notified');
  assert.equal(new URL(app.state.href).searchParams.get('tema'), next === 'light' ? 'chiaro' : 'scuro');
  if (!options.storageDenied) assert.equal(app.values.get('hy-patrimonial-theme'), next);
}
for (const [slug, fonts] of [
  ['evento', ['Manrope', 'next/font/local', 'jetbrains-mono-latin-wght-normal.woff2', "weight: '500 600'", '--event-sans', '--event-mono']],
  ['percorso-architetto-patrimoniale', ['Space_Grotesk', 'IBM_Plex_Sans', 'IBM_Plex_Mono', '--architect-display', '--architect-sans', '--architect-mono']],
]) {
  const route = read(`src/app/(site)/(patrimonial-pilot)/benessere-patrimoniale/${slug}/page.tsx`);
  assert(route.includes('<PatrimonialThemeFrame>') && route.includes('</PatrimonialThemeFrame>'));
  for (const font of fonts) assert(route.includes(font), `${slug}: ${font}`);
}
for (const kind of ['event', 'architect']) {
  const css = read(`src/components/patrimonial-${kind}.module.css`);
  assert(css.includes(':global([data-theme="light"])'), `${kind}: isolated light override`);
  assert(css.includes('prefers-reduced-motion'), `${kind}: reduced motion preserved`);
}
assert(source.includes('aria-label="Anteprima tema della pagina"'));
console.log('PASS shared theme: SSR, URL precedence, saved choice, both toggles, denied storage, pressed states, route fonts and scoped light/reduced-motion styles. No network.');
