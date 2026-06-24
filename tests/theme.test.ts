// tests/theme.test.ts
import { describe, it, expect } from 'vitest';
import { resolveInitialTheme, nextTheme, THEME_EVENT } from '../src/scripts/theme';

describe('resolveInitialTheme', () => {
  it('prefers a stored value over system', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });
  it('falls back to system when nothing stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });
  it('ignores invalid stored values', () => {
    expect(resolveInitialTheme('purple', true)).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('toggles', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});

describe('THEME_EVENT', () => {
  it('is a stable event name', () => {
    expect(THEME_EVENT).toBe('themechange');
  });
});
