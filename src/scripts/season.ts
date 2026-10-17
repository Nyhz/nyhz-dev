// src/scripts/season.ts — a few days of the year the site notices on its own.

export type Season = 'halloween' | 'xmas' | 'innocents' | 'programmers' | null;

/** the 256th day of the year: 13 Sep, or 12 Sep in a leap year */
function isProgrammersDay(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  const day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 864e5) + 1;
  return day === 256;
}

export function seasonOf(d: Date): Season {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 10 && day === 31) return 'halloween';
  if (m === 12 && day >= 24 && day <= 26) return 'xmas';
  if (m === 12 && day === 28) return 'innocents'; // Spain's April Fools'
  if (isProgrammersDay(d)) return 'programmers';
  return null;
}
