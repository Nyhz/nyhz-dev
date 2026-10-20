// src/scripts/tv.ts — the television's logic that needs no DOM: the remote's
// number keys, what a channel number tunes to, and the teletext pages.

/** what typing a channel number on the remote gets you */
export type Channel =
  | { kind: 'project'; index: number }
  | { kind: 'contact' }
  | { kind: 'secret' }      // CH 42
  | { kind: 'horror' }      // CH 13
  | { kind: 'nosignal'; n: number };

export function channelFor(n: number, count: number): Channel {
  if (n === 0) return { kind: 'contact' };
  if (n >= 1 && n <= count) return { kind: 'project', index: n - 1 };
  if (n === 42) return { kind: 'secret' };
  if (n === 13) return { kind: 'horror' };
  return { kind: 'nosignal', n };
}

/**
 * The remote's digit entry: digits pile up (two at most for channels, three
 * on teletext pages); `ready` says the number is complete and can be acted on
 * now — otherwise the caller waits a beat for another digit.
 */
export function remoteDigit(buffer: string, digit: string, max: number): { buffer: string; ready: boolean } {
  const next = (buffer + digit).slice(-max);
  return { buffer: next, ready: next.length >= max };
}

/** "CH 0_" while you type, "CH 07" once it's in */
export const remoteLabel = (buffer: string, max = 2) => buffer.padEnd(max, '_');

// ---- volume ----
export const VOL_MAX = 8;
export const volumeBar = (level: number) => `VOL ${'▮'.repeat(level)}${'▯'.repeat(VOL_MAX - level)}`;
export const clampVolume = (v: number) => Math.max(0, Math.min(VOL_MAX, v));

// ---- teletext ----
// A page is rows of segments: [colour, text]. Colours are teletext's own
// (w y c g r m b); a row can be double height ('dh') or a fastext bar.
export type Seg = [string, string];
export type Row = { segs: Seg[]; dh?: boolean; bg?: string; link?: number; ch?: number; href?: string };
export type TxtContext = {
  name: string; role: string; location: string;
  projects: { title: string; status: string }[];
  skills: { title: string; items: string[] }[];
  socials: { label: string; url: string }[];
};

export const TXT_HOME = 100;
export const FASTEXT: [string, string, number][] = [['r', 'ABOUT', 101], ['g', 'SKILLS', 102], ['y', 'PROJECTS', 103], ['c', 'CONTACT', 104]];

const dots = (k: string, w = 12) => `${k} ${'.'.repeat(Math.max(1, w - k.length))} `;
const strip = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** the page's rows, or null when there's no such page */
export function teletextPage(n: number, ctx: TxtContext): Row[] | null {
  const live = ctx.projects.filter((p) => p.status === 'live').length;
  const title = (t: string, c = 'c'): Row => ({ segs: [[c, t]], dh: true });
  const blank: Row = { segs: [['w', ' ']] };
  switch (n) {
    case 100:
      return [
        { segs: [['w', `  ${ctx.name.toUpperCase().split('').join(' ')}   T E X T  `]], dh: true, bg: 'b' },
        blank,
        { segs: [['y', ' 101  '], ['w', 'about']], link: 101 },
        { segs: [['y', ' 102  '], ['w', 'skills']], link: 102 },
        { segs: [['y', ' 103  '], ['w', 'projects · the guide']], link: 103 },
        { segs: [['y', ' 104  '], ['w', 'contact']], link: 104 },
        { segs: [['y', ' 105  '], ['w', 'making of · how this tv was built']], link: 105 },
        blank,
        { segs: [['c', ' 888  '], ['c', 'subtitles']], link: 888 },
        blank,
        { segs: [['g', ' type a page number, or pick a colour']] },
      ];
    case 101:
      return [
        title('ABOUT'),
        blank,
        { segs: [['c', dots('name')], ['w', ctx.name]] },
        { segs: [['c', dots('role')], ['w', ctx.role]] },
        { segs: [['c', dots('based')], ['w', ctx.location]] },
        { segs: [['c', dots('on air')], ['w', `${ctx.projects.length} channels, ${live} live`]] },
        blank,
        { segs: [['w', 'senior developer who can\'t leave a']] },
        { segs: [['w', 'good idea alone. i build the things']] },
        { segs: [['w', 'i\'d want to use myself, start to']] },
        { segs: [['w', 'finish, and keep polishing long']] },
        { segs: [['w', 'after they work.']] },
      ];
    case 102:
      return [
        title('SKILLS'),
        blank,
        ...ctx.skills.flatMap((s): Row[] => [
          { segs: [['y', ` ${s.title.toUpperCase()}`]] },
          { segs: [['w', `   ${s.items.join(' · ')}`]] },
        ]),
      ];
    case 103:
      return [
        title('THE GUIDE'),
        blank,
        ...ctx.projects.map((p, i): Row => ({
          segs: [['y', ` ${String(i + 1).padStart(2, '0')}  `], ['w', p.title.padEnd(20).slice(0, 20)],
            [p.status === 'live' ? 'g' : p.status === 'download' ? 'c' : p.status === 'in progress' ? 'y' : 'm', p.status.toUpperCase()]],
          ch: i + 1,
        })),
      ];
    case 104:
      return [
        title('CONTACT'),
        blank,
        { segs: [['w', ' write to me: press '], ['y', '0'], ['w', ' on your remote']], ch: 0 },
        { segs: [['w', ' (that tunes to channel 00)']] },
        blank,
        ...ctx.socials.map((s): Row => ({ segs: [['c', dots(s.label, 10)], ['w', strip(s.url)]] })),
      ];
    case 105:
      return [
        title('MAKING OF'),
        blank,
        { segs: [['w', ' how this tv was built, step by step:']] },
        { segs: [['w', ' the picture, the static, the crt switch,']] },
        { segs: [['w', ' the remote, this teletext, the ticker']] },
        { segs: [['w', ' and the ambilight — with the code.']] },
        blank,
        { segs: [['y', ' read it '], ['c', '› nyhz.dev/lab/tv']], href: '/lab/tv/' },
      ];
    case 888:
      return [
        title('SUBTITLES', 'y'),
        blank,
        { segs: [['w', ' [ static hisses softly ]']] },
        { segs: [['w', ' [ a modem dials somewhere ]']] },
        { segs: [['c', ' NARRATOR: '], ['w', 'and so the visitor']] },
        { segs: [['w', '            kept reading teletext']] },
        { segs: [['w', '            in the year 2026.']] },
        { segs: [['w', ' [ dramatic synth sting ]']] },
      ];
    default:
      return null;
  }
}

export const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** a page as the screen's markup (rows + the fastext bar); its text comes from the CMS, so it's escaped */
export function teletextHTML(n: number, ctx: TxtContext): string {
  const rows = teletextPage(n, ctx);
  const body = rows
    ? rows.map((r) => `<span class="tr${r.dh ? ' dh' : ''}${r.bg ? ` bg-${r.bg}` : ''}"${r.link ? ` data-go="p${r.link}"` : r.ch !== undefined ? ` data-go="c${r.ch}"` : r.href ? ` data-go="u${esc(r.href)}"` : ''}>${r.segs.map(([c, t]) => `<span class="k-${c}">${esc(t)}</span>`).join('')}</span>`).join('')
    : `<span class="tr"> </span><span class="tr k-r"> PAGE ${n} NOT FOUND</span><span class="tr k-w"> nothing on this page. try 100.</span><span class="tr" data-go="p100"><span class="k-y"> 100 </span><span class="k-w">index</span></span>`;
  const fast = `<div class="fast">${FASTEXT.map(([c, t, p]) => `<span class="k-${c}" data-go="p${p}">${t}</span>`).join('')}</div>`;
  return body + fast;
}
