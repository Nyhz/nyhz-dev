// tests/eggs.test.ts
import { describe, it, expect } from 'vitest';
import { createAchievements, konamiStep, KONAMI, clockNote, EGGS, REQUIRED, ago, leet, encodeCert, decodeCert, serial, took } from '../src/scripts/eggs';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('achievements', () => {
  it('unlocks once and persists', () => {
    const store = memory();
    const a = createAchievements(store);
    expect(a.unlock('gravity')).toBe(true);
    expect(a.unlock('gravity')).toBe(false);
    expect(createAchievements(store).has('gravity')).toBe(true);
    expect(a.count()).toBe(1);
  });
  it('survives broken or missing storage', () => {
    const bad = { getItem: () => '{nope', setItem: () => { throw new Error('quota'); } };
    const a = createAchievements(bad);
    expect(a.count()).toBe(0);
    expect(a.unlock('leet')).toBe(true);
    expect(createAchievements(null).count()).toBe(0);
  });
  it('lists found and hidden eggs with a score', () => {
    const a = createAchievements(memory());
    a.unlock('konami');
    const lines = a.lines();
    expect(lines).toHaveLength(EGGS.length + 1);
    const i = REQUIRED.findIndex((e) => e.id === 'konami');
    expect(lines[i]).toBe('◆ old habits');
    expect(lines[i === 0 ? 1 : 0]).toBe('◇ ???');
    expect(lines[REQUIRED.length]).toBe(`1/${REQUIRED.length} found`);
    expect(lines.at(-1)).toBe('◇ ??? (bonus, phone only)');
  });
  it('keeps the phone-only bonus out of the score and the certificate', () => {
    const a = createAchievements(memory());
    expect(a.total).toBe(EGGS.length - 1);
    a.unlock('shake');
    expect(a.count()).toBe(0);
    expect(a.span()).toBeNull();
    REQUIRED.forEach((e) => a.unlock(e.id));
    expect(a.complete()).toBe(true);
    expect(a.lines().at(-1)).toBe('◆ earthquake (bonus)');
  });
});

describe('konami', () => {
  const run = (keys: string[]) => keys.reduce(konamiStep, 0);
  it('completes on the full sequence', () => {
    expect(run(KONAMI)).toBe(KONAMI.length);
    expect(run(KONAMI.map((k) => k.toUpperCase().length === 1 ? k.toUpperCase() : k))).toBe(KONAMI.length);
  });
  it('tolerates an extra ↑ at the start and resets on a wrong key', () => {
    expect(run(['ArrowUp', ...KONAMI])).toBe(KONAMI.length);
    expect(run(['ArrowUp', 'ArrowUp', 'x'])).toBe(0);
  });
});

describe('clockNote', () => {
  it('speaks at 13:37 and 03:33 only', () => {
    expect(clockNote(13, 37)).toBe("leet o'clock");
    expect(clockNote(3, 33)).toBe('go to sleep');
    expect(clockNote(13, 38)).toBe('');
  });
});

describe('ago', () => {
  it('rounds to the largest unit', () => {
    expect(ago(3 * 864e5 + 5e6)).toBe('3 days');
    expect(ago(36e5)).toBe('1 hour');
    expect(ago(20 * 6e4)).toBe('20 minutes');
    expect(ago(1000)).toBe('1 minute');
  });
});

describe('leet', () => {
  it('speaks it', () => {
    expect(leet('Relica Idle')).toBe('R3l1c4 1dl3');
    expect(leet('selected work')).toBe('53l3c73d w0rk');
  });
});

describe('certificate', () => {
  it('records when the first and last eggs were found', () => {
    let t = 1000;
    const a = createAchievements(memory(), () => t);
    a.unlock('gravity'); t = 5000; a.unlock('wave');
    expect(a.span()).toEqual({ first: 1000, last: 5000 });
    expect(a.complete()).toBe(false);
  });
  it('round-trips through a URL-safe hash, unicode names included', () => {
    const c = { n: 'Ñandú 🦤', f: 1, l: 2, c: 16 };
    const h = encodeCert(c);
    expect(h).toMatch(/^[\w-]+$/);
    expect(decodeCert(h)).toEqual(c);
    expect(decodeCert('garbage!!')).toBeNull();
  });
  it('has a stable serial and a readable duration', () => {
    expect(serial({ n: 'a', f: 1, l: 2, c: 16 })).toBe(serial({ n: 'a', f: 1, l: 2, c: 16 }));
    expect(serial({ n: 'a', f: 1, l: 2, c: 16 })).toMatch(/^0x[0-9a-f]{4}·[0-9a-f]{4}$/);
    expect(took(3 * 864e5 + 12 * 36e5)).toBe('3d 12h');
    expect(took(5 * 36e5 + 20 * 6e4)).toBe('5h 20m');
  });
});
