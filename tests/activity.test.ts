// tests/activity.test.ts
import { describe, it, expect } from 'vitest';
import { fromEvents, relTime } from '../src/scripts/activity';

const push = (repo: string, msg: string, isPublic = true) => ({
  type: 'PushEvent', created_at: '2026-10-17T00:04:46Z', public: isPublic,
  repo: { name: `Nyhz/${repo}` }, payload: { commits: [{ message: 'older' }, { message: `${msg}\n\nbody` }] },
});

describe('fromEvents', () => {
  it('takes the newest push and its last commit headline', () => {
    expect(fromEvents([{ type: 'WatchEvent', created_at: '', repo: { name: 'x/y' }, payload: {} }, push('nyhz-dev', 'feat: x')]))
      .toEqual({ repo: 'nyhz-dev', message: 'feat: x', at: '2026-10-17T00:04:46Z', private: false });
  });
  it('never exposes a private repo\'s commit message', () => {
    expect(fromEvents([push('relica-idle', 'secret stuff', false)])?.message).toBe('');
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
