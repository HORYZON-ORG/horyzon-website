'use client';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import styles from './patrimonial-theme.module.css';

export type PatrimonialTheme = 'dark' | 'light';
const STORAGE_KEY = 'hy-patrimonial-theme';
// ?tema=chiaro / ?tema=scuro lets a link open straight on one variant (handy for the review vote).
const fromParam = (value: string | null): PatrimonialTheme | null => value === 'chiaro' ? 'light' : value === 'scuro' ? 'dark' : null;

// Tiny store: the server renders the page's default theme (dark unless the page asks otherwise);
// the browser picks up ?tema= or the last choice right after hydration.
let current: PatrimonialTheme | null = null;
const listeners = new Set<() => void>();
function readInitial(fallback: PatrimonialTheme, remember: boolean): PatrimonialTheme {
  const param = fromParam(new URLSearchParams(window.location.search).get('tema'));
  if (param) return param;
  if (!remember) return fallback;
  try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved === 'light' || saved === 'dark') return saved; } catch { /* storage unavailable */ }
  return fallback;
}
const themeStore = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  // Only an explicit choice is kept in memory, so each page falls back to its own default.
  getSnapshot: (fallback: PatrimonialTheme, remember: boolean): PatrimonialTheme => current ?? readInitial(fallback, remember),
  set(next: PatrimonialTheme, remember: boolean) {
    current = next;
    if (remember) try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable: theme still switches for this view */ }
    const url = new URL(window.location.href);
    url.searchParams.set('tema', next === 'light' ? 'chiaro' : 'scuro');
    window.history.replaceState(window.history.state, '', url);
    listeners.forEach(listener => listener());
  },
};

// Pre-launch preview of the two looks of the same landing. The dark theme is the original;
// the light one is generated from it (scripts/build-patrimonial-light-theme.mjs). Once a look
// is chosen, render the children without this frame, or fix the theme and drop the bar.
const ThemeContext = createContext<{ theme: PatrimonialTheme; choose: (next: PatrimonialTheme) => void } | null>(null);

// One round button that switches between the two looks; for pages that place it in their own header.
export function PatrimonialThemeToggle({ className }: { className?: string }) {
  const context = useContext(ThemeContext);
  if (!context) return null;
  const dark = context.theme === 'dark';
  return <button type="button" className={className} aria-label={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'} title={dark ? 'Tema chiaro' : 'Tema scuro'} onClick={() => context.choose(dark ? 'light' : 'dark')}>
    {dark
      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>}
  </button>;
}

// rememberChoice=false: the page always opens on its default theme (an explicit ?tema= still wins)
// and a click switches only the current view, without touching the choice saved by other pages.
export function PatrimonialThemeFrame({ children, defaultTheme = 'dark', showBar = true, rememberChoice = true }: { children: React.ReactNode; defaultTheme?: PatrimonialTheme; showBar?: boolean; rememberChoice?: boolean }) {
  const getSnapshot = useCallback(() => themeStore.getSnapshot(defaultTheme, rememberChoice), [defaultTheme, rememberChoice]);
  const getServerSnapshot = useCallback(() => defaultTheme, [defaultTheme]);
  const theme = useSyncExternalStore(themeStore.subscribe, getSnapshot, getServerSnapshot);
  const choose = (next: PatrimonialTheme) => themeStore.set(next, rememberChoice);

  return <ThemeContext.Provider value={{ theme, choose }}><div data-theme={theme} className={styles.frame}>
    {showBar && <div className={styles.bar} role="group" aria-label="Anteprima tema della pagina">
      <span className={styles.label}>Anteprima tema</span>
      <div className={styles.switch}>
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
          Scuro
        </button>
        <button type="button" aria-pressed={theme === 'light'} onClick={() => choose('light')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          Chiaro
        </button>
      </div>
    </div>}
    {children}
  </div></ThemeContext.Provider>;
}
