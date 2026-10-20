// tests/rss.test.ts
import { describe, it, expect } from 'vitest';
import { rss, rfc822 } from '../src/scripts/rss';

describe('the lab feed', () => {
  const feed = rss({
    title: 'nyhz — lab', description: 'Under the hood', site: 'https://www.nyhz.dev/lab/', self: 'https://www.nyhz.dev/lab/rss.xml',
    items: [{ title: 'Ticks & <loot>', url: 'https://www.nyhz.dev/lab/relica-idle/', date: '2026-10-20', summary: 'It "fights"', tags: ['node'] }],
  });
  it('dates items the RFC 822 way', () => {
    expect(rfc822('2026-10-20')).toBe('Tue, 20 Oct 2026 00:00:00 GMT');
  });
  it('writes an escaped RSS 2.0 channel with its items', () => {
    expect(feed).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(feed).toContain('<title>Ticks &amp; &lt;loot&gt;</title>');
    expect(feed).toContain('<description>It &quot;fights&quot;</description>');
    expect(feed).toContain('<guid isPermaLink="true">https://www.nyhz.dev/lab/relica-idle/</guid>');
    expect(feed).toContain('<category>node</category>');
    expect(feed).toContain('<lastBuildDate>Tue, 20 Oct 2026 00:00:00 GMT</lastBuildDate>');
  });
});
