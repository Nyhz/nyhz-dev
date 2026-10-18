// tests/activity.test.ts
import { describe, it, expect } from 'vitest';
import { fromEvents, relTime } from '../src/scripts/activity';

// GitHub's push events today: no commits, just the head sha
const push = (repo: string, isPublic = true) => ({
  type: 'PushEvent', created_at: '2026-10-17T00:04:46Z', public: isPublic,
  repo: { name: `Nyhz/${repo}` }, payload: { head: 'abc123' },
});
// the older shape, with the commits inline
const legacy = (repo: string, msg: string) => ({
  ...push(repo), payload: { head: 'abc123', commits: [{ message: 'older' }, { message: `${msg}\n\nbody` }] },
});

describe('fromEvents', () => {
  it('takes the newest push and names the commit to look up', () => {
    expect(fromEvents([{ type: 'WatchEvent', created_at: '', repo: { name: 'x/y' }, payload: {} }, push('nyhz-dev')]))
      .toEqual({
        activity: { repo: 'nyhz-dev', message: '', at: '2026-10-17T00:04:46Z', private: false },
        lookup: { repo: 'Nyhz/nyhz-dev', sha: 'abc123' },
      });
  });
  it('uses inline commits when the event still has them', () => {
    expect(fromEvents([legacy('nyhz-dev', 'feat: x')])).toEqual({
      activity: { repo: 'nyhz-dev', message: 'feat: x', at: '2026-10-17T00:04:46Z', private: false }, lookup: null,
    });
  });
  it('never exposes (or looks up) a private repo\'s commit', () => {
    const p = fromEvents([{ ...legacy('relica-idle', 'secret stuff'), public: false }]);
    expect(p?.activity.message).toBe('');
    expect(p?.lookup).toBeNull();
  });
  it('returns null without pushes', () => {
    expect(fromEvents([])).toBeNull();
  });
});

describe('relTime', () => {
  it('scales the unit', () => {
    expect(relTime(20e3)).toBe('just now');
    expect(relTime(12 * 6e4)).toBe('12m ago');
    expect(relTime(3 * 36e5)).toBe('3h ago');
    expect(relTime(5 * 864e5)).toBe('5d ago');
  });
});
