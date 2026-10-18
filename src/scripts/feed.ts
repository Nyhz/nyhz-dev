// src/scripts/feed.ts — the site's live data, fetched once and shared: the
// frame's last-push line and the tv's news ticker both read it. Nothing
// throws; no data is null.
import type { Activity } from './activity';
import type { Ping } from './status';

const get = <T>(url: string) =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);

let act: Promise<Activity | null> | null = null;
/** the latest push (api/activity, cached an hour at the edge) */
export const activity = () => (act ??= get<Activity>('/api/activity'));

let pingsP: Promise<Ping[] | null> | null = null;
let pingsAt = 0;
/** the deploys' pings (api/status, cached two minutes at the edge); asked again once older than maxAge */
export function pings(maxAge = 120_000) {
  if (!pingsP || Date.now() - pingsAt > maxAge) {
    pingsAt = Date.now();
    pingsP = get<Ping[]>('/api/status');
  }
  return pingsP;
}
