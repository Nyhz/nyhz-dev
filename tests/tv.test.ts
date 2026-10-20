// tests/tv.test.ts
import { describe, it, expect } from 'vitest';
import { channelFor, remoteDigit, remoteLabel, volumeBar, clampVolume, teletextPage, teletextHTML, type TxtContext } from '../src/scripts/tv';

const ctx: TxtContext = {
  name: 'nyhz', role: 'creative developer', location: 'somewhere on earth',
  projects: [{ title: 'Relica Idle', status: 'live' }, { title: 'HL Bot', status: 'personal' }],
  skills: [{ title: 'Frontend', items: ['astro', 'gsap'] }],
  socials: [{ label: 'github', url: 'https://github.com/nyhz/' }],
};

describe('the remote', () => {
  it('maps numbers to channels', () => {
    expect(channelFor(0, 9)).toEqual({ kind: 'contact' });
    expect(channelFor(7, 9)).toEqual({ kind: 'project', index: 6 });
    expect(channelFor(42, 9)).toEqual({ kind: 'secret' });
    expect(channelFor(13, 9)).toEqual({ kind: 'horror' });
    expect(channelFor(57, 9)).toEqual({ kind: 'nosignal', n: 57 });
    expect(channelFor(10, 9)).toEqual({ kind: 'nosignal', n: 10 });
  });
  it('collects digits up to the limit', () => {
    expect(remoteDigit('', '0', 2)).toEqual({ buffer: '0', ready: false });
    expect(remoteDigit('0', '7', 2)).toEqual({ buffer: '07', ready: true });
    expect(remoteDigit('10', '3', 3)).toEqual({ buffer: '103', ready: true });
    expect(remoteLabel('0')).toBe('0_');
  });
  it('draws the volume bar and keeps it in range', () => {
    expect(volumeBar(3)).toBe('VOL ▮▮▮▯▯▯▯▯');
    expect(clampVolume(12)).toBe(8);
    expect(clampVolume(-1)).toBe(0);
  });
});

describe('teletext', () => {
  const text = (n: number) => teletextPage(n, ctx)?.map((r) => r.segs.map((s) => s[1]).join('')).join('\n') ?? null;
  it('has an index that links to its pages', () => {
    const p = teletextPage(100, ctx)!;
    expect(p.filter((r) => r.link).map((r) => r.link)).toEqual([101, 102, 103, 104, 105, 888]);
  });
  it('fills pages from the content', () => {
    expect(text(101)).toContain('2 channels, 1 live');
    expect(text(101)).toContain('keep polishing long');
    expect(text(102)).toContain('astro · gsap');
    expect(text(103)).toContain('Relica Idle');
    expect(teletextPage(103, ctx)!.filter((r) => r.ch).map((r) => r.ch)).toEqual([1, 2]);
    expect(text(104)).toContain('github.com/nyhz');
  });
  it('has no page 555', () => {
    expect(teletextPage(555, ctx)).toBeNull();
  });
});

describe('teletext markup', () => {
  it('escapes text from the CMS', () => {
    const html = teletextHTML(103, { ...ctx, projects: [{ title: '<img src=x onerror=alert(1)>', status: 'live' }] });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x');
  });
  it('links rows to pages and channels, and always has the fastext bar', () => {
    expect(teletextHTML(100, ctx)).toContain('data-go="p101"');
    expect(teletextHTML(103, ctx)).toContain('data-go="c1"');
    expect(teletextHTML(555, ctx)).toMatch(/PAGE 555 NOT FOUND.*class="fast"/);
  });
  it('links the making-of page off the tv, to the post', () => {
    expect(teletextHTML(105, ctx)).toContain('data-go="u/lab/tv/"');
  });
});
