// src/scripts/lab/index.ts — the lab's demos, by slug (= the content's file
// name in src/content/lab). Each is its own chunk, fetched when it's tuned in:
// the home page doesn't pay for a demo nobody opens.
import type { LabCtx, Mount } from './kit';

export const DEMOS: Record<string, () => Promise<Mount>> = {
  'film-grain': () => import('./film-grain').then((m) => m.mount),
  'crt-power': () => import('./crt-power').then((m) => m.mount),
  'dvd-bounce': () => import('./dvd-bounce').then((m) => m.mount),
  ambilight: () => import('./ambilight').then((m) => m.mount),
  'endless-ticker': () => import('./endless-ticker').then((m) => m.mount),
};

/** mounts the demo into host; resolves to its cleanup (a no-op if there's no such demo or it failed to load) */
export async function mountDemo(slug: string, host: HTMLElement, ctx: LabCtx): Promise<() => void> {
  const load = DEMOS[slug];
  if (!load) return () => {};
  try { return (await load())(host, ctx); } catch { return () => {}; }
}
