// /lab/rss.xml: the lab's posts as a feed, built with the site
import type { APIRoute } from 'astro';
import { getContent } from '../../scripts/content';
import { getPosts } from '../../scripts/posts';
import { rss } from '../../scripts/rss';

export const GET: APIRoute = async ({ site }) => {
  const { profile } = await getContent();
  const at = (path: string) => new URL(path, site).href;
  const body = rss({
    title: `${profile.name} — lab`,
    description: `Under the hood: how the things ${profile.name} builds actually work, step by step, with the code and the mistakes.`,
    site: at('/lab/'),
    self: at('/lab/rss.xml'),
    items: getPosts().map((p) => ({ title: p.meta.title, url: at(`/lab/${p.slug}/`), date: p.meta.date, summary: p.meta.summary, tags: p.meta.tags })),
  });
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
