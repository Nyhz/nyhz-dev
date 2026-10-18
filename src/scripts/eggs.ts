// src/scripts/eggs.ts — the site's easter eggs: the achievement registry and
// the bits of logic that don't need a DOM (konami matcher, clock notes).
// Effects live in Eggs.astro; anything can unlock one by dispatching
// `nyhz:achieve` with { id }.

export const EGGS = [
  { id: 'sleep', title: 'you left me here', hint: 'leave me alone for a bit' },
  { id: 'gravity', title: 'gravity works', hint: 'poke my name. a lot.' },
  { id: 'overheat', title: 'overclocked', hint: 'move your mouse like crazy' },
  { id: 'wave', title: 'say my name', hint: 'type my name' },
  { id: 'konami', title: 'old habits', hint: 'an old cheat code: ↑↑↓↓…' },
  { id: 'return', title: 'you came back', hint: 'come back in a few hours' },
  { id: 'leet', title: 'right on time', hint: 'be here at 13:37' },
  // a bonus: phones only (motion sensor), so it never counts toward the total
  { id: 'shake', title: 'earthquake', hint: 'on your phone: shake it', bonus: true },
  { id: 'snake', title: 'ssssnake', hint: 'terminal — play a game. eat ten.' },
  { id: 'secrets', title: 'curious one', hint: 'in the terminal, look for hidden files' },
  { id: 'matrix', title: 'follow the white rabbit', hint: 'terminal — wake up, neo' },
  { id: 'light', title: 'no light mode', hint: 'terminal — ask for light mode' },
  { id: 'vim', title: 'how do i exit vim', hint: 'terminal — open an editor. try leaving.' },
  { id: 'panic', title: 'crash test dummy', hint: 'terminal — break everything (linux or windows)' },
  { id: 'root', title: 'root access', hint: 'terminal — become root. start with sudo' },
  { id: 'console', title: 'devtools dweller', hint: 'open the browser console' },
  { id: 'channel', title: 'off the air', hint: 'tune the tv to a channel that isn\'t listed (number keys)' },
  { id: 'smack', title: 'percussive maintenance', hint: 'when the picture goes bad, smack the tv (double-click)' },
] as const;

export type EggId = (typeof EGGS)[number]['id'];
export const isEgg = (id: string): id is EggId => EGGS.some((e) => e.id === id);
export const isBonus = (id: EggId) => EGGS.some((e) => e.id === id && 'bonus' in e && e.bonus);
/** the ones that count: every one of them can be found on a computer */
export const REQUIRED = EGGS.filter((e) => !isBonus(e.id));

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const KEY = 'nyhz:eggs';
const TIMES = 'nyhz:eggs:t';

/** Found eggs (and when), persisted per browser. Storage may be missing or throw (private mode). */
export function createAchievements(store: Store | null, now: () => number = Date.now) {
  let found: EggId[] = [];
  let times: Partial<Record<EggId, number>> = {};
  try {
    const raw = JSON.parse(store?.getItem(KEY) || '[]');
    if (Array.isArray(raw)) found = raw.filter((x): x is EggId => typeof x === 'string' && isEgg(x));
    const t = JSON.parse(store?.getItem(TIMES) || '{}');
    if (t && typeof t === 'object') times = t;
  } catch { /* start empty */ }
  const counted = () => found.filter((id) => !isBonus(id));
  const stamps = () => counted().map((id) => times[id]).filter((t): t is number => typeof t === 'number');

  return {
    has: (id: EggId) => found.includes(id),
    /** found among the required ones (bonuses don't count) */
    count: () => counted().length,
    total: REQUIRED.length,
    /** returns true only the first time */
    unlock(id: EggId) {
      if (found.includes(id)) return false;
      found = [...found, id];
      times = { ...times, [id]: now() };
      try {
        store?.setItem(KEY, JSON.stringify(found));
        store?.setItem(TIMES, JSON.stringify(times));
      } catch { /* memory only */ }
      return true;
    },
    complete: () => counted().length === REQUIRED.length,
    /** when the first and the last were found (ms), for the certificate */
    span() {
      const t = stamps();
      return t.length ? { first: Math.min(...t), last: Math.max(...t) } : null;
    },
    /** the terminal's `achievements` listing */
    lines() {
      const n = counted().length, total = REQUIRED.length;
      return [
        ...REQUIRED.map((e) => (found.includes(e.id) ? `◆ ${e.title}` : '◇ ???')),
        `${n}/${total} found${n === total ? ' — all of them.' : ''}`,
        ...EGGS.filter((e) => isBonus(e.id)).map((e) => (found.includes(e.id) ? `◆ ${e.title} (bonus)` : '◇ ??? (bonus, phone only)')),
      ];
    },
  };
}

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Feeds one key into the konami matcher; returns the new progress (KONAMI.length = done). */
export function konamiStep(progress: number, key: string): number {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === KONAMI[progress]) return progress + 1;
  return k === KONAMI[0] ? (progress === 2 ? 2 : 1) : 0; // ↑↑↑ keeps you at ↑↑
}

/** the certificate's data, shareable as a URL hash (#cert=…) */
export type Cert = { n: string; f: number; l: number; c: number };
// UTF-8 bytes → base64url (names can be anything, emoji included)
export const encodeCert = (c: Cert) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(c))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decodeCert(s: string): Cert | null {
  try {
    const bytes = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
    const c = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (typeof c?.f !== 'number' || typeof c?.l !== 'number' || typeof c?.c !== 'number') return null;
    return { n: String(c.n ?? '').slice(0, 32), f: c.f, l: c.l, c: c.c };
  } catch { return null; }
}
/** a short, stable serial for a certificate */
export function serial(c: Cert): string {
  let h = 0x811c9dc5;
  for (const ch of `${c.n}|${c.f}|${c.l}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const x = h.toString(16).padStart(8, '0');
  return `0x${x.slice(0, 4)}·${x.slice(4)}`;
}
/** "3d 12h" / "5h 20m" / "12m" */
export function took(ms: number): string {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d ? `${d}d ${h % 24}h` : h ? `${h}h ${m % 60}m` : `${Math.max(1, m)}m`;
}

/** "3 days" / "5 hours" / "20 minutes" — how long since the last visit */
export function ago(ms: number): string {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return d ? unit(d, 'day') : h ? unit(h, 'hour') : unit(Math.max(1, m), 'minute');
}

const LEET: Record<string, string> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', z: '2' };
/** "Relica Idle" → "R3l1c4 1dl3" */
export const leet = (text: string) => text.replace(/[aeiostz]/gi, (c) => LEET[c.toLowerCase()]);

/** A word for the corner clock at its special minutes, or '' */
export function clockNote(h: number, m: number): string {
  if (h === 13 && m === 37) return "leet o'clock";
  if (h === 3 && m === 33) return 'go to sleep';
  return '';
}

let shared: ReturnType<typeof createAchievements> | null = null;
/** the page-wide instance (browser localStorage, when it's allowed) */
export function achievements() {
  if (!shared) {
    let store: Store | null = null;
    try { store = window.localStorage; } catch { /* blocked */ }
    shared = createAchievements(store);
  }
  return shared;
}
