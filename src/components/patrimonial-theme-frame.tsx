'use client';
import { useSyncExternalStore } from 'react';
import styles from './patrimonial-theme.module.css';

export type PatrimonialTheme = 'dark' | 'light';
const STORAGE_KEY = 'hy-patrimonial-theme';
// ?tema=chiaro / ?tema=scuro lets a link open straight on one variant (handy for the review vote).
const fromParam = (value: string | null): PatrimonialTheme | null => value === 'chiaro' ? 'light' : value === 'scuro' ? 'dark' : null;

// Tiny store: the server always renders the original dark theme; the browser picks up
// ?tema= or the last choice right after hydration.
let current: PatrimonialTheme | null = null;
const listeners = new Set<() => void>();
function readInitial(): PatrimonialTheme {
  const param = fromParam(new URLSearchParams(window.location.search).get('tema'));
  if (param) return param;
  try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved === 'light' || saved === 'dark') return saved; } catch { /* storage unavailable */ }
  return 'dark';
}
const themeStore = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: (): PatrimonialTheme => (current ??= readInitial()),
  getServerSnapshot: (): PatrimonialTheme => 'dark',
  set(next: PatrimonialTheme) {
    current = next;
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable: theme still switches for this view */ }
    const url = new URL(window.location.href);
    url.searchParams.set('tema', next === 'light' ? 'chiaro' : 'scuro');
    window.history.replaceState(window.history.state, '', url);
    listeners.forEach(listener => listener());
  },
};

// Pre-launch preview of the two looks of the same landing. The dark theme is the original;
// the light one is generated from it (scripts/build-patrimonial-light-theme.mjs). Once a look
// is chosen, render the children without this frame, or fix the theme and drop the bar.
export function PatrimonialThemeFrame({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, themeStore.getServerSnapshot);
  const choose = (next: PatrimonialTheme) => themeStore.set(next);

  return <div data-theme={theme} className={styles.frame}>
    <div className={styles.bar} role="group" aria-label="Anteprima tema della pagina">
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
    </div>
    {children}
  </div>;
}
