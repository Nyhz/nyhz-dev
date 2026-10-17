// tests/status.test.ts
import { describe, it, expect } from 'vitest';
import { liveTargets, isUp, statusLine } from '../src/scripts/status';

describe('status', () => {
  it('reads deploy URLs from the project YAMLs, https only', () => {
    expect(liveTargets({
      '../../content/projects/relica-idle.yaml': "title: Relica Idle\ndeployUrl: https://relica.nyhz.dev\n",
      '../../content/projects/hl-bot.yaml': "title: HL Bot\ndeployUrl: ''\n",
      '../../content/projects/x.yaml': "deployUrl: 'https://x.dev/'\n",
      '../../content/projects/y.yaml': 'deployUrl: http://insecure.dev\n',
    })).toEqual([{ slug: 'relica-idle', url: 'https://relica.nyhz.dev' }, { slug: 'x', url: 'https://x.dev/' }]);
  });
  it('counts any answer below 500 as up', () => {
    expect(isUp(200)).toBe(true);
    expect(isUp(401)).toBe(true);
    expect(isUp(503)).toBe(false);
    expect(isUp(0)).toBe(false);
  });
  it('prints a row', () => {
    expect(statusLine({ slug: 'relica-idle', up: true, ms: 84 })).toBe('relica-idle       ● up · 84ms');
    expect(statusLine({ slug: 'warera-pulse', up: false, ms: null })).toBe('warera-pulse      ● down');
  });
});
