// src/pages/api/activity.ts — the latest push, for the frame's corner line.
// With GITHUB_TOKEN (read-only) it sees private repos too (name only, see
// fromEvents); without one it falls back to the newest public repo's last
// commit. Cached at the edge for an hour, so GitHub is barely touched.
import type { APIRoute } from 'astro';
import { fromEvents, type Activity } from '../../scripts/activity';

export const prerender = false;

const USER = 'Nyhz';
const gh = (path: string, token?: string) =>
  fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nyhz.dev', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

async function latest(token?: string): Promise<Activity | null> {
  if (token) {
    const a = fromEvents(await gh(`/users/${USER}/events?per_page=30`, token));
    if (a) return a;
  }
  const [repo] = await gh(`/users/${USER}/repos?sort=pushed&per_page=1`);
  if (!repo) return null;
  const [commit] = await gh(`/repos/${USER}/${repo.name}/commits?per_page=1`);
  return {
    repo: repo.name,
    message: commit?.commit?.message?.split('\n')[0] ?? '',
    at: commit?.commit?.committer?.date ?? repo.pushed_at,
    private: false,
  };
}

export const GET: APIRoute = async () => {
  let body: Activity | null = null;
  try { body = await latest(process.env.GITHUB_TOKEN); } catch { /* the corner just stays empty */ }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
