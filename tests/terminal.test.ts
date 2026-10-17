// tests/terminal.test.ts
import { describe, it, expect } from 'vitest';
import { runCommand, complete, findProject, vimReply, sshReply, cowsay, FORTUNES, PRE, type TermContext } from '../src/scripts/terminal';

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
    expect(runCommand('whoami', ctx).lines).toEqual([
      'name      nyhz',
      'role      creative developer',
      'based     somewhere on earth',
      'work      3 projects, 1 live',
      'reach     github',
    ]);
  });
  it('prints a project\'s description and stack when opening it', () => {
    const c = { ...ctx, projects: [{ slug: 'a', title: 'A', status: 'live', description: 'does things', tags: ['x', 'y'] }] };
    expect(runCommand('open a', c).lines).toEqual(['→ A', 'does things', 'stack     x · y', 'status    live']);
  });
  it('echoes its argument', () => {
    expect(runCommand('echo hello  there', ctx).lines).toEqual(['hello there']);
  });
  it('falls back to command not found', () => {
    expect(runCommand('make sandwich', ctx).lines[0]).toBe('command not found: make — try help');
  });
});

describe('easter eggs', () => {
  it('shows dotfiles with ls -a and unlocks reading .secrets', () => {
    const la = runCommand('ls -la', ctx).lines;
    expect(la.slice(0, 3)).toEqual(['.plan     my todo list', '.vimrc    editor config', '.secrets  cat .secrets']);
    expect(la).toHaveLength(3 + 1 + 3);
    expect(runCommand('ls', ctx).lines).toHaveLength(3);
    expect(runCommand('cat .secrets', ctx).action).toEqual({ type: 'achieve', id: 'secrets' });
    expect(runCommand('cat .plan', ctx).action).toEqual({ type: 'none' });
    expect(runCommand('open .secrets', ctx).lines[0]).toBe('open: .secrets: not a project — try cat');
  });
  it('refuses to cd up', () => {
    expect(runCommand('cd ..', ctx).lines[0]).toBe('nice try. this is as far up as it goes.');
  });
  it('rains on matrix', () => {
    expect(runCommand('matrix', ctx).action).toEqual({ type: 'matrix' });
  });
  it('panics on rm -rf /, the fork bomb and /dev/urandom', () => {
    for (const l of ['rm -rf /', 'sudo rm -rf /', 'rm -fr /*', 'rm -rf ~', ':(){ :|:& };:', 'cat /dev/urandom']) {
      expect(runCommand(l, ctx).action, l).toEqual({ type: 'panic' });
    }
    expect(runCommand('rm notes.txt', ctx).lines).toEqual(['nice try.']);
    expect(runCommand('rm -rf node_modules', ctx).action).toEqual({ type: 'none' });
  });
  it('leads from sudo to ssh to nmap to the backdoor', () => {
    expect(runCommand('sudo make', ctx).lines[1]).toBe('» root logs in over ssh, though. try: ssh root@nyhz.dev');
    expect(runCommand('root', ctx).lines[1]).toBe('» start with: sudo');
    expect(runCommand('ssh root@nyhz.dev', ctx).action).toEqual({ type: 'ssh', target: 'root@nyhz.dev' });
    expect(runCommand('ssh example.com', ctx).lines[0]).toMatch(/Connection refused/);
    expect(sshReply(0).done).toBe(false);
    expect(sshReply(2).lines.at(-1)).toBe("» there's always another way in. scan for open doors: nmap nyhz.dev");
    expect(sshReply(2).done).toBe(true);
    const scan = runCommand('nmap nyhz.dev', ctx).lines;
    expect(scan).toContain(`${PRE}31337/tcp  open      backdoor`);
    expect(scan.at(-1)).toBe('» 31337 is open, and it says backdoor. knock: nc nyhz.dev 31337');
    expect(runCommand('nc nyhz.dev 31337', ctx).action).toEqual({ type: 'root' });
    expect(runCommand('nc nyhz.dev 22', ctx).action).toEqual({ type: 'none' });
  });
});

describe('vim and light mode', () => {
  it('enters vim and only lets you out with a quit command', () => {
    expect(runCommand('vim', ctx).action).toEqual({ type: 'vim' });
    expect(vimReply('exit', 0)).toEqual({ lines: ['-- INSERT --'], exit: false });
    expect(vimReply(':exit', 1)).toEqual({ lines: ['E492: Not an editor command: exit'], exit: false });
    // no hint until the third line — then it explains, condescendingly
    expect(vimReply('help', 2).lines).toContain('you type a colon, then q, then enter: :q');
    expect(vimReply('please', 5).lines[0]).toBe('still here? colon. q. enter.');
    expect(vimReply('why', 11).exit).toBe(false);
    expect(vimReply(':wq', 2).exit).toBe(true);
    expect(vimReply(' :q! ', 3).exit).toBe(true);
  });
  it('refuses light mode', () => {
    expect(runCommand('theme light', ctx)).toEqual({ lines: ['no.'], action: { type: 'flash' } });
    expect(runCommand('theme dark', ctx).action).toEqual({ type: 'none' });
  });
});

describe('unix toys', () => {
  it('tells a fortune', () => {
    expect(runCommand('fortune', ctx, new Date(), () => 0).lines).toEqual([FORTUNES[0]]);
  });
  it('has a cow say things, wrapped in a bubble', () => {
    const one = cowsay('moo').map((l) => l.slice(PRE.length));
    expect(one.slice(0, 3)).toEqual([' _____', '< moo >', ' -----']);
    const many = cowsay('a fairly long sentence that has to wrap onto more than one line', 20).map((l) => l.slice(PRE.length));
    expect(many[1].startsWith('/ ')).toBe(true);
    expect(many.some((l) => l.startsWith('\\ '))).toBe(true);
    expect(runCommand('fortune | cowsay', ctx, new Date(), () => 0).lines.join('\n')).toContain('it works on my machine.');
  });
  it('runs the train and blue-screens on windows commands', () => {
    expect(runCommand('sl', ctx).action).toEqual({ type: 'sl' });
    for (const l of ['format c:', 'del /s /q c:\\windows\\system32', 'rd /s c:\\', 'shutdown /s', 'taskkill /im explorer.exe']) {
      expect(runCommand(l, ctx).action, l).toEqual({ type: 'bsod' });
    }
  });
});

describe('coffee', () => {
  it('is a teapot', () => {
    for (const l of ['coffee', 'make coffee', 'sudo make coffee', 'brew']) {
      expect(runCommand(l, ctx).lines[0], l).toBe("HTTP/1.1 418 I'm a teapot");
    }
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
