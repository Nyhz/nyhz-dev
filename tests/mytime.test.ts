// tests/mytime.test.ts
import { describe, it, expect } from 'vitest';
import { timeIn, doing, hhmm, apart, utc } from '../src/scripts/mytime';

describe('timeIn', () => {
  it('reads the wall clock in the zone, summer and winter', () => {
    const summer = timeIn(new Date('2026-07-01T00:05:00Z'), 'Europe/Madrid');
    expect(summer).toEqual({ h: 2, m: 5, day: 3, offset: 120 });
    const winter = timeIn(new Date('2026-12-31T23:30:00Z'), 'Europe/Madrid');
    expect(winter).toEqual({ h: 0, m: 30, day: 5, offset: 60 }); // already friday there
    expect(hhmm(winter)).toBe('00:30');
  });
  it('handles zones behind UTC and on the half hour', () => {
    expect(timeIn(new Date('2026-01-10T03:00:00Z'), 'America/New_York')).toMatchObject({ h: 22, day: 5, offset: -300 });
    expect(timeIn(new Date('2026-01-10T03:00:00Z'), 'Asia/Kolkata')).toMatchObject({ h: 8, m: 30, offset: 330 });
  });
});

describe('doing', () => {
  it('follows the day', () => {
    expect(doing(3, 2)).toBe('asleep, probably');
    expect(doing(1, 2)).toBe('probably still coding');
    expect(doing(8, 2)).toBe('coffee first');
    expect(doing(14, 2)).toBe('lunch');
    expect(doing(23, 2)).toBe("side projects o'clock");
  });
  it('knows the weekend', () => {
    expect(doing(11, 3)).toBe('at work');
    expect(doing(11, 6)).toBe('out and about');
    expect(doing(17, 0)).toBe('building things');
  });
});

describe('apart', () => {
  it('says how far, and nothing when it is the same', () => {
    expect(apart(120, 120)).toBe('');
    expect(apart(120, -300)).toBe('7h ahead of you');
    expect(apart(60, 330)).toBe('4.5h behind you');
  });
});

describe('utc', () => {
  it('names the zone by its offset', () => {
    expect(utc(120)).toBe('UTC+2');
    expect(utc(60)).toBe('UTC+1');
    expect(utc(330)).toBe('UTC+5:30');
    expect(utc(-300)).toBe('UTC-5');
    expect(utc(-570)).toBe('UTC-9:30');
    expect(utc(0)).toBe('UTC');
  });
});
