// src/scripts/terminal.ts — the frame's `/` prompt. Pure: parses a command
// line against the site's content and returns output lines + an action for
// the UI to perform.

export type TermContext = {
  name: string;
  role: string;
  location: string;
  projects: { slug: string; title: string; status: string }[];
  socials: { label: string; url: string }[];
};

export type TermAction =
  | { type: 'none' }
  | { type: 'open'; slug: string }
  | { type: 'contact' }
  | { type: 'url'; url: string }
  | { type: 'clear' }
  | { type: 'exit' }
  | { type: 'glitch' };

export type TermResult = { lines: string[]; action: TermAction };

export const COMMANDS = ['help', 'ls', 'open', 'contact', 'whoami', 'socials', 'glitch', 'date', 'echo', 'clear', 'exit'];

const none: TermAction = { type: 'none' };
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function findProject(ctx: TermContext, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const n = Number(q);
  if (Number.isInteger(n) && n >= 1 && n <= ctx.projects.length) return ctx.projects[n - 1];
  const s = slugify(q);
  return ctx.projects.find((p) => p.slug === s || slugify(p.title) === s)
    ?? ctx.projects.find((p) => p.slug.startsWith(s) || slugify(p.title).startsWith(s));
}

export function runCommand(input: string, ctx: TermContext, now: Date = new Date()): TermResult {
  const line = input.trim();
  if (!line) return { lines: [], action: none };
  const [rawCmd, ...rest] = line.split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const arg = rest.join(' ');
  const social = ctx.socials.find((s) => s.label.toLowerCase() === cmd);

  if (social) return { lines: [`→ ${social.url.replace(/^https?:\/\/(www\.)?/, '')}`], action: { type: 'url', url: social.url } };

  switch (cmd) {
    case 'help':
    case '?':
      return {
        lines: [
          'ls              list projects',
          'open <n|name>   inspect a project',
          'contact         write to me',
          'socials         where else i am',
          'whoami · date · echo · glitch',
          'clear · exit    (esc closes)',
        ],
        action: none,
      };
    case 'ls':
    case 'projects':
      return {
        lines: ctx.projects.map((p, i) => `${String(i + 1).padStart(2, '0')}  ${p.slug.padEnd(18)}${p.status}`),
        action: none,
      };
    case 'open':
    case 'cd':
    case 'cat': {
      if (!arg) return { lines: [`usage: ${cmd} <n|name>`], action: none };
      const p = findProject(ctx, arg);
      if (!p) return { lines: [`${cmd}: no such project: ${arg}`], action: none };
      return { lines: [`→ ${p.title}`], action: { type: 'open', slug: p.slug } };
    }
    case 'contact':
    case 'hire':
    case 'mail':
      return { lines: ['opening a channel…'], action: { type: 'contact' } };
    case 'socials':
      return { lines: ctx.socials.map((s) => `${s.label.padEnd(10)}${s.url.replace(/^https?:\/\/(www\.)?/, '')}`), action: none };
    case 'whoami':
      return { lines: [[ctx.name, ctx.role, ctx.location].filter(Boolean).join(' — ')], action: none };
    case 'date':
      return { lines: [now.toString().split(' (')[0]], action: none };
    case 'echo':
      return { lines: [arg], action: none };
    case 'glitch':
      return { lines: ['b̷z̴z̵t̶'], action: { type: 'glitch' } };
    case 'clear':
      return { lines: [], action: { type: 'clear' } };
    case 'exit':
    case 'quit':
    case 'q':
      return { lines: [], action: { type: 'exit' } };
    case 'sudo':
      return { lines: [`${ctx.name || 'you'} is not in the sudoers file. this incident will be reported.`], action: none };
    case 'rm':
      return { lines: ['nice try.'], action: none };
    default:
      return { lines: [`command not found: ${cmd} — try help`], action: none };
  }
}

/** Tab completion: commands first, then project slugs after `open `. */
export function complete(input: string, ctx: TermContext): string {
  const m = input.match(/^(\s*)(\S*)(\s+)?(.*)$/);
  if (!m) return input;
  const [, lead, cmd, space, arg] = m;
  if (!space) {
    const c = cmd.toLowerCase();
    const hits = [...COMMANDS, ...ctx.socials.map((s) => s.label.toLowerCase())].filter((x) => x.startsWith(c));
    return hits.length === 1 ? `${lead}${hits[0]} ` : input;
  }
  if (['open', 'cd', 'cat'].includes(cmd.toLowerCase())) {
    const a = slugify(arg);
    const hits = ctx.projects.filter((p) => p.slug.startsWith(a));
    return hits.length === 1 ? `${lead}${cmd} ${hits[0].slug}` : input;
  }
  return input;
}
