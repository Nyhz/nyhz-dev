// src/scripts/status.ts — the terminal's `status`: are the live projects up?
// Pure helpers; the pings run in pages/api/status.ts.

export type Ping = { slug: string; up: boolean; ms: number | null };

/** slug + deploy URL for every project YAML that has one (raw file text in, so it can be bundled) */
export function liveTargets(files: Record<string, string>): { slug: string; url: string }[] {
  return Object.entries(files)
    .map(([path, text]) => ({
      slug: path.split('/').pop()!.replace(/\.ya?ml$/, ''),
      url: (text.match(/^deployUrl:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ?? '').trim(),
      order: Number(text.match(/^order:\s*(\d+)/m)?.[1] ?? 999),
    }))
    .filter((t) => /^https:\/\//.test(t.url))
    .sort((a, b) => a.order - b.order) // same order as the site's list
    .map(({ slug, url }) => ({ slug, url }));
}

/** a server answering at all (even 401/404) is up; 5xx, timeouts and network errors are down */
export const isUp = (status: number) => status > 0 && status < 500;

/** one terminal row: "relica-idle       ● up · 84ms" */
export const statusLine = (p: Ping) =>
  `${p.slug.padEnd(16)}  ${p.up ? `● up · ${p.ms}ms` : '● down'}`;
