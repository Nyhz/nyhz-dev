// src/scripts/theme.ts
export type Theme = 'dark' | 'light';
export const THEME_EVENT = 'themechange';
const KEY = 'nyhz-theme';

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyTheme(mode: Theme): void {
  document.documentElement.dataset.theme = mode;
  try { localStorage.setItem(KEY, mode); } catch {}
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
}

export function readStoredTheme(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
