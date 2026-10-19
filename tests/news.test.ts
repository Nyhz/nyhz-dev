// tests/news.test.ts
import { describe, it, expect } from 'vitest';
import { newsItems, newsHTML, type NewsInput } from '../src/scripts/news';

const now = Date.parse('2026-10-18T12:00:00Z');
const base: NewsInput = {
  projects: [
    { slug: 'relica-idle', title: 'Relica Idle', status: 'live', repo: 'https://github.com/Nyhz/relica-idle' },
    { slug: 'hipotecalc', title: 'Hipotecalc', status: 'live', repo: '' },
    { slug: 'hl-bot', title: 'HL Bot', status: 'personal', repo: 'https://github.com/Nyhz/hl-bot/' },
  ],
  pings: null, activity: null, found: 0, total: 17, location: 'somewhere on earth', touch: false, now,
};
const text = (it: { segs: [string, string][] }) => it.segs.map((s) => s[1]).join(' ');

describe('newsItems', () => {
  it('opens with what is on air, from the content alone', () => {
    const items = newsItems(base);
    expect(text(items[0])).toBe('on air 3 channels · 2 live');
    // no data yet: no pings, no push — just the evergreen headlines
    expect(items.map((i) => i.segs[0][1])).toEqual(['on air', 'breaking', 'remote', 'weather']);
  });

  it('reports every deploy, tuning to its channel', () => {
    const items = newsItems({ ...base, pings: [
      { slug: 'hipotecalc', up: true, ms: 84 },
      { slug: 'relica-idle', up: false, ms: null },
      { slug: 'gone', up: true, ms: 9 }, // not a channel any more
    ] });
    expect(items[1]).toEqual({ ch: 1, segs: [['k', 'Hipotecalc'], ['up', '● live · 84ms']] });
    expect(items[2]).toEqual({ ch: 0, segs: [['k', 'Relica Idle'], ['down', '● no signal']] });
    expect(items.some((i) => text(i).includes('gone'))).toBe(false);
  });

  it('carries the last push, linked to its project when it is one', () => {
    const items = newsItems({ ...base, activity: { repo: 'relica-idle', message: 'feat: raids', at: '2026-10-18T10:00:00Z', private: false } });
    const push = items.find((i) => i.segs[0][1] === 'last push')!;
    expect(text(push)).toBe('last push relica-idle 2h ago — “feat: raids”');
    expect(push.ch).toBe(0);
  });

  it('matches a push by the repo url too, and leaves other repos unlinked', () => {
    const hl = newsItems({ ...base, activity: { repo: 'hl-bot', message: '', at: '2026-10-18T11:59:50Z', private: false } });
    expect(hl.find((i) => i.segs[0][1] === 'last push')?.ch).toBe(2);
    const site = newsItems({ ...base, activity: { repo: 'nyhz-dev', message: 'x', at: '2026-10-18T11:00:00Z', private: false } });
    expect(site.find((i) => i.segs[0][1] === 'last push')?.ch).toBeUndefined();
  });

  it('never shows a private repo\'s message', () => {
    const items = newsItems({ ...base, activity: { repo: 'secret', message: 'should not leak', at: '2026-10-18T11:00:00Z', private: true } });
    const push = text(items.find((i) => i.segs[0][1] === 'last push')!);
    expect(push).toBe('last push secret 1h ago · private repo');
  });

  it('clips a long commit message', () => {
    const items = newsItems({ ...base, activity: { repo: 'nyhz-dev', message: 'x'.repeat(200), at: '2026-10-18T11:00:00Z', private: false } });
    const msg = items.find((i) => i.segs[0][1] === 'last push')!.segs.at(-1)![1];
    expect(msg.length).toBeLessThan(72);
    expect(msg).toMatch(/…”$/);
  });

  it('follows the secrets from none to all', () => {
    const at = (found: number) => text(newsItems({ ...base, found }).find((i) => /secret/.test(text(i)))!);
    expect(at(0)).toBe('breaking 17 secrets reported on this page');
    expect(at(5)).toBe('secrets 5 of 17 found so far');
    expect(at(17)).toBe('breaking all 17 secrets found — certificate issued');
  });

  it('reads my clock, saying how far it is only when it differs', () => {
    const at = (apart: string) => text(newsItems({ ...base, clock: { time: '02:14', doing: 'asleep, probably', apart } }).find((i) => i.segs[0][1] === 'my clock')!);
    expect(at('7h ahead of you')).toBe('my clock 02:14 · asleep, probably · 7h ahead of you');
    expect(at('')).toBe('my clock 02:14 · asleep, probably');
    expect(newsItems(base).some((i) => i.segs[0][1] === 'my clock')).toBe(false);
  });

  it('gives touch screens their own remote', () => {
    expect(text(newsItems({ ...base, touch: true }).find((i) => i.segs[0][1] === 'remote')!)).toContain('swipe');
    expect(text(newsItems(base).find((i) => i.segs[0][1] === 'remote')!)).toContain('t teletext');
  });
});

describe('newsHTML', () => {
  it('escapes what comes from outside (commit messages)', () => {
    const html = newsHTML(newsItems({ ...base, activity: { repo: 'x', message: '<img src=x onerror=alert(1)>', at: '2026-10-18T11:00:00Z', private: false } }));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
  it('marks clickable headlines with their channel', () => {
    expect(newsHTML([{ ch: 3, segs: [['k', 'a']] }, { segs: [['d', 'b']] }]))
      .toBe('<span class="ni" data-tune="3"><span class="n-k">a</span></span><span class="ni"><span class="n-d">b</span></span>');
  });
});
