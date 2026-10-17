// src/scripts/terminal.ts — the frame's `/` prompt. Pure: parses a command
// line against the site's content and returns output lines + an action for
// the UI to perform.

export type TermContext = {
  name: string;
  role: string;
  location: string;
  projects: { slug: string; title: string; status: string; description?: string; tags?: string[] }[];
  socials: { label: string; url: string }[];
};

export type TermAction =
  | { type: 'none' }
  | { type: 'open'; slug: string }
  | { type: 'contact' }
  | { type: 'url'; url: string }
  | { type: 'clear' }
  | { type: 'exit' }
  | { type: 'glitch' }
  | { type: 'matrix' }
  | { type: 'achieve'; id: string }
  | { type: 'achievements' }
  | { type: 'vim' }
  | { type: 'flash' }
  | { type: 'ssh'; target: string }
  | { type: 'root' }
  | { type: 'panic' }
  | { type: 'snake' }
  | { type: 'status' }
  | { type: 'cert' }
  | { type: 'bsod' }
  | { type: 'sl' };

/** a line the terminal prints as-is (no column layout) */
export const PRE = '\u200b';
const pre = (s: string) => PRE + s;
const pad2 = (n: number) => String(n).padStart(2, '0');

export type TermResult = { lines: string[]; action: TermAction };

export const COMMANDS = ['help', 'ls', 'open', 'contact', 'whoami', 'socials', 'status', 'snake', 'glitch', 'date', 'echo', 'clear', 'exit'];

const none: TermAction = { type: 'none' };

// the hidden files `ls -a` shows (and what it says about them); reading
// .secrets is an achievement
const DOTFILE_INFO: Record<string, string> = {
  '.plan': 'my todo list',
  '.vimrc': 'editor config',
  '.secrets': 'cat .secrets',
};
const DOTFILES: Record<string, string[]> = {
  '.plan': ['- ship relica idle', '- make things that feel alive', '- sleep more (failing)'],
  '.vimrc': ['set number', 'set nocompatible', '" there is a vim in here. you may not get out.'],
  '.secrets': [
    'there is no secret. only more doors:',
    '  konami code',
    '  my name doesn\'t like being poked. five times.',
    '  leave me alone for a while',
    '  come back at 13:37',
    '  matrix',
    '  say my name',
    '  ask for light mode: theme light',
    '  sudo. then follow the doors.',
    '  rm -rf /   (please don\'t)',
    '  on windows? format c:',
    '  vim. if you dare',
    '  open the console',
    'achievements keeps score.',
  ],
};
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

// fortune: a random line, every time
export const FORTUNES = [
  'it works on my machine.',
  'there are 2 hard problems in computer science: cache invalidation, naming things, and off-by-one errors.',
  'a good programmer looks both ways before crossing a one-way street.',
  "99 little bugs in the code. take one down, patch it around. 127 little bugs in the code.",
  "it's not a bug, it's an undocumented feature.",
  'weeks of coding can save you hours of planning.',
  'the best code is no code at all.',
  'debugging is twice as hard as writing the code in the first place.',
  'git commit -m "fix" — the most honest lie ever told.',
  'there is no cloud. it\'s just someone else\'s computer.',
  'first, solve the problem. then, write the code.',
  'delete code, not features.',
  'real programmers count from 0.',
  'one does not simply exit vim.',
  'the s in iot stands for security.',
  'premature optimization is the root of all evil.',
  'any sufficiently advanced bug is indistinguishable from a feature.',
  'it compiled on the first try. be very afraid.',
];

/** cowsay: the text in a speech bubble, wrapped, said by a cow */
export function cowsay(text: string, width = 34): string[] {
  const words = (text.trim() || 'moo.').split(/\s+/);
  const rows: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > width) { rows.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  rows.push(cur);
  const n = Math.max(...rows.map((r) => r.length));
  const pad = (r: string) => r + ' '.repeat(n - r.length);
  const body = rows.length === 1
    ? [`< ${pad(rows[0])} >`]
    : rows.map((r, i) => `${i === 0 ? '/' : i === rows.length - 1 ? '\\' : '|'} ${pad(r)} ${i === 0 ? '\\' : i === rows.length - 1 ? '/' : '|'}`);
  return [
    ` ${'_'.repeat(n + 2)}`,
    ...body,
    ` ${'-'.repeat(n + 2)}`,
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ].map(pre);
}

export function runCommand(input: string, ctx: TermContext, now: Date = new Date(), rnd: () => number = Math.random): TermResult {
  const line = input.trim();
  if (!line) return { lines: [], action: none };
  const [rawCmd, ...rest] = line.split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const arg = rest.join(' ');
  const social = ctx.socials.find((s) => s.label.toLowerCase() === cmd);

  // things that break the machine — the most-tried lines in any fake terminal
  if (/^(sudo\s+)?rm\s+-(rf|fr|r\s+-f|f\s+-r)\w*\s+(\/|\/\*|~|\.)\s*$/i.test(line)
    || /^:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:$/.test(line)
    || /^(sudo\s+)?(cat|head)\s+\/dev\/(u?random|zero)\b/i.test(line)) {
    return { lines: [], action: { type: 'panic' } };
  }

  // the windows way to break the machine: a blue screen
  if (/^format\s+c:?/i.test(line) || /system32/i.test(line) || /^del\s+\/[sfq]/i.test(line)
    || /^(rd|rmdir)\s+\/s/i.test(line) || /^shutdown(\.exe)?\s+[/-][srp]\b/i.test(line) || /^taskkill\b/i.test(line)) {
    return { lines: [], action: { type: 'bsod' } };
  }

  // fortune, cowsay, and the classic: fortune | cowsay
  if (/^fortune\s*\|\s*cowsay$/i.test(line)) return { lines: cowsay(FORTUNES[Math.floor(rnd() * FORTUNES.length)]), action: none };

  // RFC 2324 / 7168: a teapot refuses to brew coffee
  if (/^(sudo\s+)?(make\s+|brew\s+)?coffee$/i.test(line) || /^brew$/i.test(line)) {
    return {
      lines: [
        'HTTP/1.1 418 I\'m a teapot',
        pre('             ;,\''),
        pre('     _o_    ;:;\''),
        pre(' ,-.\'---`.__ ;'),
        pre('((j`=====\',-\''),
        pre(' `-\\     /'),
        pre('    `-=-\''),
        'this server refuses to brew coffee. it is, permanently, a teapot.',
      ],
      action: none,
    };
  }

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
          'status          are the live ones up?',
          'snake           play on the frame',
          'whoami · date · echo · glitch',
          'clear · exit    (esc closes)',
          '…and a few things it won\'t tell you. ls -a',
        ],
        action: none,
      };
    case 'ls':
    case 'projects': {
      const rows = ctx.projects.map((p, i) => `${String(i + 1).padStart(2, '0')}  ${p.slug.padEnd(16)}  ${p.status}`);
      if (!/(^|\s)-\w*a/.test(arg)) return { lines: rows, action: none };
      // the hidden files first, one per row with what they are, then the projects
      const dots = Object.entries(DOTFILE_INFO).map(([f, what]) => `${f.padEnd(8)}  ${what}`);
      return { lines: [...dots, pre(' '), ...rows], action: none };
    }
    case 'open':
    case 'cd':
    case 'cat': {
      if (!arg) return { lines: [`usage: ${cmd} <n|name>`], action: none };
      if (cmd === 'cd' && ['..', '/', '~', '-'].includes(arg)) return { lines: ['nice try. this is as far up as it goes.'], action: none };
      const file = DOTFILES[arg.toLowerCase()];
      if (file) {
        if (cmd !== 'cat') return { lines: [`${cmd}: ${arg}: not a project — try cat`], action: none };
        return { lines: file, action: arg.toLowerCase() === '.secrets' ? { type: 'achieve', id: 'secrets' } : none };
      }
      const p = findProject(ctx, arg);
      if (!p) return { lines: [`${cmd}: no such project: ${arg}`], action: none };
      const lines = [`→ ${p.title}`];
      if (p.description) lines.push(p.description);
      if (p.tags?.length) lines.push(`stack     ${p.tags.join(' · ')}`, `status    ${p.status}`);
      return { lines, action: { type: 'open', slug: p.slug } };
    }
    case 'contact':
    case 'hire':
    case 'mail':
      return { lines: ['opening a channel…'], action: { type: 'contact' } };
    case 'socials':
      return { lines: ctx.socials.map((s) => `${s.label.padEnd(8)}  ${s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`), action: none };
    case 'whoami': {
      const live = ctx.projects.filter((p) => p.status === 'live').length;
      const rows: [string, string][] = [
        ['name', ctx.name], ['role', ctx.role], ['based', ctx.location],
        ['work', ctx.projects.length ? `${ctx.projects.length} projects${live ? `, ${live} live` : ''}` : ''],
        ['reach', ctx.socials.map((s) => s.label).join(' · ')],
      ];
      return { lines: rows.filter(([, v]) => v).map(([k, v]) => `${k.padEnd(8)}  ${v}`), action: none };
    }
    case 'date':
      return { lines: [now.toString().split(' (')[0]], action: none };
    case 'echo':
      return { lines: [arg], action: none };
    case 'glitch':
      return { lines: ['b̷z̴z̵t̶'], action: { type: 'glitch' } };
    case 'status':
    case 'uptime':
    case 'ping':
      return { lines: ['pinging the live ones…'], action: { type: 'status' } };
    case 'fortune':
      return { lines: [FORTUNES[Math.floor(rnd() * FORTUNES.length)]], action: none };
    case 'cowsay':
      return { lines: cowsay(arg), action: none };
    case 'sl':
      return { lines: [], action: { type: 'sl' } };
    case 'snake':
    case 'play':
    case 'game':
      return { lines: ['booting snake.exe…'], action: { type: 'snake' } };
    case 'matrix':
    case 'hack':
      return { lines: ['wake up, neo…'], action: { type: 'matrix' } };
    case ':q':
    case ':q!':
    case ':wq':
      return { lines: ["you're not in vim. yet. (try vim)"], action: none };
    case 'vim':
    case 'vi':
    case 'nvim':
      return { lines: VIM_SPLASH, action: { type: 'vim' } };
    case 'nano':
      return { lines: ['real ones use vim. try it.'], action: none };
    case 'emacs':
      return { lines: ['nice operating system. lacks a decent editor.'], action: none };
    case 'theme':
    case 'lightmode':
      if (cmd === 'lightmode' || arg === 'light') return { lines: ['no.'], action: { type: 'flash' } };
      if (arg === 'dark') return { lines: ['already dark. always dark.'], action: none };
      return { lines: ['usage: theme dark|light'], action: none };
    case 'cert':
    case 'certificate':
      return { lines: [], action: { type: 'cert' } };
    case 'achievements':
    case 'trophies':
      return { lines: [], action: { type: 'achievements' } };
    case 'clear':
      return { lines: [], action: { type: 'clear' } };
    case 'exit':
    case 'quit':
    case 'q':
      return { lines: [], action: { type: 'exit' } };
    case 'sudo':
      return { lines: [`${ctx.name || 'you'} is not in the sudoers file. this incident will be reported.`, '» root logs in over ssh, though. try: ssh root@nyhz.dev'], action: none };
    case 'su':
    case 'root':
      return { lines: ["you're not root. yet.", '» start with: sudo'], action: none };
    case 'rm':
      return { lines: ['nice try.'], action: none };
    // the road to root: sudo → ssh (locked) → nmap → nc on the backdoor
    case 'ssh': {
      const m = arg.match(/^(?:-\S+\s+)*(?:([\w.-]+)@)?([\w.-]+)$/);
      if (!m) return { lines: ['usage: ssh [user@]host'], action: none };
      const host = m[2].toLowerCase();
      if (!/^(nyhz\.dev|www\.nyhz\.dev|localhost|127\.0\.0\.1)$/.test(host)) {
        return { lines: [`ssh: connect to host ${m[2]} port 22: Connection refused`], action: none };
      }
      return { lines: [], action: { type: 'ssh', target: `${m[1] || 'root'}@${host}` } };
    }
    case 'nmap':
      return {
        lines: [
          `Starting Nmap 7.95 at ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
          `Nmap scan report for ${arg.replace(/^-\S+\s*/, '') || 'nyhz.dev'}`,
          pre('PORT       STATE     SERVICE'),
          pre('22/tcp     filtered  ssh (locked)'),
          pre('80/tcp     open      http'),
          pre('443/tcp    open      https'),
          pre('1337/tcp   open      elite'),
          pre('31337/tcp  open      backdoor'),
          'Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds',
          '» 31337 is open, and it says backdoor. knock: nc nyhz.dev 31337',
        ],
        action: none,
      };
    case 'nc':
    case 'ncat':
    case 'netcat':
    case 'telnet': {
      const [, port] = arg.split(/\s+/);
      if (port === '31337') return { lines: [`Connected to ${arg.split(/\s+/)[0]}:31337.`, 'backdoor v0.1 — welcome, root.'], action: { type: 'root' } };
      if (!arg) return { lines: [`usage: ${cmd} <host> <port>`], action: none };
      return { lines: [`${cmd}: connect to ${arg.replace(/\s+/, ' port ')} failed: Connection refused`], action: none };
    }
    default:
      return { lines: [`command not found: ${cmd} — try help`], action: none };
  }
}

const VIM_SPLASH = [
  '~',
  '~    VIM - Vi IMproved',
  '~    version 9.1',
  '~    by Bram Moolenaar et al.',
  '~',
];

// every third line typed, vim (well, this one) takes pity and explains
const PITY = [
  ["it's fine. it happens to everyone.", 'you type a colon, then q, then enter: :q', 'people have been stuck in here since 1991.'],
  ['still here? colon. q. enter.', 'slowly this time: :q'],
  ['at this point you live here.', ":q — that's it. that's the whole trick."],
];

/** Inside the fake vim: everything but a quit command keeps you in, with real
 *  vim errors and no hints — until every third line, when it explains, kindly
 *  and condescendingly. `n` = lines typed so far. */
export function vimReply(input: string, n: number): { lines: string[]; exit: boolean } {
  const line = input.trim();
  if (/^:(q|q!|qa|qa!|wq|wq!|x|x!)$/.test(line)) return { lines: ["you made it. most people don't."], exit: true };
  if ((n + 1) % 3 === 0) return { lines: PITY[Math.min((n + 1) / 3 - 1, PITY.length - 1)], exit: false };
  if (line.startsWith(':')) return { lines: [`E492: Not an editor command: ${line.slice(1)}`], exit: false };
  const errs = [['-- INSERT --'], ['E37: No write since last change (add ! to override)'], [`E492: Not an editor command: ${line}`]];
  return { lines: errs[n % errs.length], exit: false };
}

/** The ssh password prompt: every attempt fails; the third locks port 22 and hints at another way in. */
export function sshReply(attempt: number): { lines: string[]; done: boolean } {
  if (attempt < 2) return { lines: ['Permission denied, please try again.'], done: false };
  return {
    lines: ['Permission denied (publickey,password).', 'too many attempts. port 22 locked.', "» there's always another way in. scan for open doors: nmap nyhz.dev"],
    done: true,
  };
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
