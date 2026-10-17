// tests/season.test.ts
import { describe, it, expect } from 'vitest';
import { seasonOf } from '../src/scripts/season';

describe('seasonOf', () => {
  it('knows its days', () => {
    expect(seasonOf(new Date(2026, 9, 31))).toBe('halloween');
    expect(seasonOf(new Date(2026, 11, 24))).toBe('xmas');
    expect(seasonOf(new Date(2026, 11, 26))).toBe('xmas');
    expect(seasonOf(new Date(2026, 11, 28))).toBe('innocents');
    expect(seasonOf(new Date(2026, 8, 13))).toBe('programmers'); // not a leap year
    expect(seasonOf(new Date(2028, 8, 12))).toBe('programmers'); // leap year
    expect(seasonOf(new Date(2026, 9, 18))).toBeNull();
  });
});
