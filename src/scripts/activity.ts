// src/scripts/activity.ts — "last push" for the frame's top-left corner.
// Pure helpers; the GitHub calls live in pages/api/activity.ts.

export type Activity = { repo: string; message: string; at: string; private: boolean };

type PushEvent = {
  type: string; created_at: string; public?: boolean;
  repo: { name: string }; payload: { commits?: { message: string }[]; head?: string };
};

export const headline = (message: unknown) => (typeof message === 'string' ? message.split('\n')[0] : '');

/**
 * The newest push in a GitHub events list. Private repos give their name only,
 * never a message. GitHub's push events no longer carry their commits, so for
 * a public repo `lookup` names the commit whose message still has to be fetched.
 */
export function fromEvents(events: PushEvent[]): { activity: Activity; lookup: { repo: string; sha: string } | null } | null {
  const e = events.find((x) => x.type === 'PushEvent');
  if (!e) return null;
  const isPrivate = e.public === false;
  const commits = e.payload.commits ?? [];
  const msg = isPrivate || !commits.length ? '' : headline(commits[commits.length - 1].message);
  const lookup = !isPrivate && !msg && e.payload.head ? { repo: e.repo.name, sha: e.payload.head } : null;
  return { activity: { repo: e.repo.name.split('/').pop() || e.repo.name, message: msg, at: e.created_at, private: isPrivate }, lookup };
}

/** "just now" / "12m ago" / "3h ago" / "5d ago" */
export function relTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
