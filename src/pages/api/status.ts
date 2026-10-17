// src/pages/api/status.ts — pings every project that has a live deploy. The
// targets come from the project YAMLs, bundled at build time: this route
// never fetches a URL it was handed. Cached at the edge for two minutes.
import type { APIRoute } from 'astro';
import { liveTargets, isUp, type Ping } from '../../scripts/status';

export const prerender = false;

const files = import.meta.glob('../../content/projects/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const TARGETS = liveTargets(files);

async function ping(slug: string, url: string): Promise<Ping> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'nyhz.dev status' } });
    return { slug, up: isUp(res.status), ms: Date.now() - t0 };
  } catch {
    return { slug, up: false, ms: null };
  }
}

export const GET: APIRoute = async () => {
  const pings = await Promise.all(TARGETS.map((t) => ping(t.slug, t.url)));
  return new Response(JSON.stringify(pings), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  });
};
