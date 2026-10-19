// src/scripts/mytime.ts — my clock, wherever the visitor is: the time where I
// am and what I'm probably doing at that hour. The place stays unnamed (the
// profile says "somewhere on earth"); only its time zone is used.
export const TZ = 'Europe/Madrid';

export type MyTime = { h: number; m: number; day: number; offset: number };

/** the hour, minute, weekday (0 = sunday) and UTC offset (minutes) in tz */
export function timeIn(now: Date, tz = TZ): MyTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const n = (t: string) => Number(get(t));
  const h = n('hour'), m = n('minute');
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), h, m);
  const offset = Math.round((wall - Math.floor(now.getTime() / 60000) * 60000) / 60000);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { h, m, day, offset };
}

/** what I'm probably up to */
export function doing(h: number, day: number): string {
  const weekend = day === 0 || day === 6;
  if (h < 2) return 'probably still coding';
  if (h < 7) return 'asleep, probably';
  if (h < 9) return 'coffee first';
  if (h < 14) return weekend ? 'out and about' : 'at work';
  if (h < 16) return 'lunch';
  if (h < 20) return weekend ? 'building things' : 'at work';
  if (h < 22) return 'dinner';
  return "side projects o'clock";
}

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (t: MyTime) => `${pad(t.h)}:${pad(t.m)}`;

/** how far my clock is from the visitor's (offsets in minutes east of UTC): "7h ahead of you", "" when the same */
export function apart(mine: number, theirs: number): string {
  const d = (mine - theirs) / 60;
  if (d === 0) return '';
  const n = Math.abs(d);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h ${d > 0 ? 'ahead of' : 'behind'} you`;
}
