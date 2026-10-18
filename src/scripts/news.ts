// src/scripts/news.ts — the tv's news ticker: what's actually going on, as
// headlines. Pure: the data comes in (the deploys' pings, the last push, the
// secrets found), the items go out; Tv.astro scrolls them.
import { relTime, type Activity } from './activity';
import type { Ping } from './status';
import { esc } from './tv';

/** a run of text in one style: k = a name, d = the detail, up / down = a deploy's state, hl = a headline tag */
export type NewsSeg = ['k' | 'd' | 'up' | 'down' | 'hl', string];
/** one headline; ch = the channel it tunes to when clicked (0-based) */
export type NewsItem = { segs: NewsSeg[]; ch?: number };

export type NewsInput = {
  projects: { slug: string; title: string; status: string; repo: string }[];
  pings: Ping[] | null;
  activity: Activity | null;
  found: number;
  total: number;
  location: string;
  touch: boolean;
  now: number;
};

const clip = (t: string, n = 64) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const repoName = (url: string) => url.replace(/\/+$/, '').split('/').pop()?.toLowerCase() ?? '';

export function newsItems(i: NewsInput): NewsItem[] {
  const live = i.projects.filter((p) => p.status === 'live').length;
  const items: NewsItem[] = [{ segs: [['k', 'on air'], ['d', `${i.projects.length} channels · ${live} live`]] }];

  // every deploy, as the last ping found it
  for (const p of i.pings ?? []) {
    const ch = i.projects.findIndex((x) => x.slug === p.slug);
    if (ch < 0) continue;
    items.push({ ch, segs: [['k', i.projects[ch].title], p.up ? ['up', `● live · ${p.ms}ms`] : ['down', '● no signal']] });
  }

  // the last push: a private repo gives its name only, never the message
  const a = i.activity;
  if (a?.repo) {
    const repo = a.repo.toLowerCase();
    const ch = i.projects.findIndex((x) => x.slug === repo || repoName(x.repo) === repo);
    const segs: NewsSeg[] = [['hl', 'last push'], ['k', a.repo], ['d', relTime(i.now - Date.parse(a.at))]];
    if (a.private) segs.push(['d', '· private repo']);
    else if (a.message) segs.push(['d', `— “${clip(a.message)}”`]);
    items.push(ch >= 0 ? { segs, ch } : { segs });
  }

  items.push(i.found === 0 ? { segs: [['hl', 'breaking'], ['d', `${i.total} secrets reported on this page`]] }
    : i.found < i.total ? { segs: [['hl', 'secrets'], ['d', `${i.found} of ${i.total} found so far`]] }
    : { segs: [['hl', 'breaking'], ['d', `all ${i.total} secrets found — certificate issued`]] });

  items.push(i.touch
    ? { segs: [['k', 'remote'], ['d', 'swipe to change channel · txt for teletext']] }
    : { segs: [['k', 'remote'], ['d', '1–9 channels · 0 writes to me · t teletext · + − volume']] });
  items.push({ segs: [['k', 'weather'], ['d', `${i.location || 'somewhere on earth'} · 100% chance of grain`]] });
  return items;
}

/** the ticker's markup; commit messages come from GitHub, so everything is escaped.
 *  data-tune, not data-ch: that one marks the tv's channel buttons */
export function newsHTML(items: NewsItem[], say: (t: string) => string = (t) => t): string {
  return items.map((it) => `<span class="ni"${it.ch === undefined ? '' : ` data-tune="${it.ch}"`}>${
    it.segs.map(([k, t]) => `<span class="n-${k}">${esc(say(t))}</span>`).join('')}</span>`).join('');
}
