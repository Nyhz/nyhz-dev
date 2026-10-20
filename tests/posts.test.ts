// tests/posts.test.ts
import { describe, it, expect } from 'vitest';
import { minutesToRead, section } from '../src/scripts/content';

describe('minutesToRead', () => {
  it('counts words at ~220 a minute, never less than one', () => {
    expect(minutesToRead('a few words')).toBe(1);
    expect(minutesToRead('word '.repeat(2200))).toBe(10);
    expect(minutesToRead(' spaced\n\n  out\twords ')).toBe(1);
  });
});

describe('a post\'s sections', () => {
  it('splits a numbered heading into its number and name', () => {
    expect(section('3-same-seed', '3. Same seed, same fight')).toEqual({ id: '3-same-seed', n: '03', text: 'Same seed, same fight' });
    expect(section('in-numbers', 'In numbers')).toEqual({ id: 'in-numbers', n: '', text: 'In numbers' });
  });
});
