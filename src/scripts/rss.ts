// src/scripts/rss.ts — the lab's feed (/lab/rss.xml) as RSS 2.0: each post
// with its summary and a link to read it on the site.
export type FeedItem = { title: string; url: string; date: string; summary: string; tags?: string[] };
export type Feed = { title: string; description: string; site: string; self: string; items: FeedItem[] };

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
/** yyyy-mm-dd → the RFC 822 date RSS wants (midnight UTC) */
export const rfc822 = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export function rss({ title, description, site, self, items }: Feed): string {
  const item = (i: FeedItem) => [
    '    <item>',
    `      <title>${esc(i.title)}</title>`,
    `      <link>${esc(i.url)}</link>`,
    `      <guid isPermaLink="true">${esc(i.url)}</guid>`,
    `      <pubDate>${rfc822(i.date)}</pubDate>`,
    `      <description>${esc(i.summary)}</description>`,
    ...(i.tags ?? []).map((t) => `      <category>${esc(t)}</category>`),
    '    </item>',
  ].join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${esc(title)}</title>`,
    `    <link>${esc(site)}</link>`,
    `    <description>${esc(description)}</description>`,
    '    <language>en</language>',
    `    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />`,
    ...(items[0] ? [`    <lastBuildDate>${rfc822(items[0].date)}</lastBuildDate>`] : []),
    ...items.map(item),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
