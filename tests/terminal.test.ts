// tests/terminal.test.ts
import { describe, it, expect } from 'vitest';
import { runCommand, complete, findProject, type TermContext } from '../src/scripts/terminal';

const ctx: TermContext = {
  name: 'nyhz', role: 'creative developer', location: 'somewhere on earth',
  projects: [
    { slug: 'warera-pulse', title: 'Warera Pulse', status: 'live' },
    { slug: 'taskbar-legion', title: 'Taskbar Legion', status: 'download' },
    { slug: 'nyhzops-devroom', title: 'NyhzOps Devroom', status: 'personal' },
  ],
  socials: [{ label: 'github', url: 'https://github.com/nyhz/' }],
};

describe('findProject', () => {
  it('matches by 1-based index', () => {
    expect(findProject(ctx, '2')?.slug).toBe('taskbar-legion');
  });
  it('matches by title, case-insensitive', () => {
    expect(findProject(ctx, 'Warera Pulse')?.slug).toBe('warera-pulse');
  });
  it('matches by slug prefix', () => {
    expect(findProject(ctx, 'nyhz')?.slug).toBe('nyhzops-devroom');
  });
  it('returns undefined for out-of-range index or unknown names', () => {
    expect(findProject(ctx, '9')).toBeUndefined();
    expect(findProject(ctx, 'nope')).toBeUndefined();
  });
});

describe('runCommand', () => {
  it('ignores empty input', () => {
    expect(runCommand('   ', ctx)).toEqual({ lines: [], action: { type: 'none' } });
  });
  it('lists projects with index and status', () => {
    const r = runCommand('ls', ctx);
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toMatch(/^01\s+warera-pulse\s+live$/);
  });
  it('opens a project', () => {
    expect(runCommand('open 1', ctx).action).toEqual({ type: 'open', slug: 'warera-pulse' });
    expect(runCommand('OPEN taskbar', ctx).action).toEqual({ type: 'open', slug: 'taskbar-legion' });
  });
  it('reports a missing or unknown project', () => {
    expect(runCommand('open', ctx).lines[0]).toBe('usage: open <n|name>');
    expect(runCommand('open zzz', ctx).lines[0]).toBe('open: no such project: zzz');
  });
  it('maps contact, glitch, clear and exit to actions', () => {
    expect(runCommand('contact', ctx).action).toEqual({ type: 'contact' });
    expect(runCommand('glitch', ctx).action).toEqual({ type: 'glitch' });
    expect(runCommand('clear', ctx).action).toEqual({ type: 'clear' });
    expect(runCommand('exit', ctx).action).toEqual({ type: 'exit' });
  });
  it('opens a social by its label', () => {
    expect(runCommand('github', ctx).action).toEqual({ type: 'url', url: 'https://github.com/nyhz/' });
  });
  it('answers whoami from the profile', () => {
    expect(runCommand('whoami', ctx).lines).toEqual(['nyhz — creative developer — somewhere on earth']);
  });
  it('echoes its argument', () => {
    expect(runCommand('echo hello  there', ctx).lines).toEqual(['hello there']);
  });
  it('falls back to command not found', () => {
    expect(runCommand('make coffee', ctx).lines[0]).toBe('command not found: make — try help');
  });
});

describe('complete', () => {
  it('completes a unique command', () => {
    expect(complete('wh', ctx)).toBe('whoami ');
  });
  it('leaves ambiguous input alone', () => {
    expect(complete('c', ctx)).toBe('c'); // contact / clear
  });
  it('completes a project slug after open', () => {
    expect(complete('open tas', ctx)).toBe('open taskbar-legion');
  });
});
