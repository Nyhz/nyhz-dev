// tests/posts.test.ts
import { describe, it, expect } from 'vitest';
import { minutesToRead } from '../src/scripts/content';

describe('minutesToRead', () => {
  it('counts words at ~220 a minute, never less than one', () => {
    expect(minutesToRead('a few words')).toBe(1);
    expect(minutesToRead('word '.repeat(2200))).toBe(10);
    expect(minutesToRead(' spaced\n\n  out\twords ')).toBe(1);
  });
});
