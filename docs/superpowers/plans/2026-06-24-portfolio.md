# nyhz-dev Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page, no-scroll, monochrome personal portfolio with an animated loader, an interactive 3D particle centerpiece, a hover-driven projects list, a dark/light switch, and git-based CMS-editable content.

**Architecture:** Astro static site (ships ~0 JS) with two client islands — a Three.js particle canvas and small vanilla-TS controllers for theme + loader. Keystatic provides a git-based CMS whose content is read at build time via the Keystatic reader and passed as plain props to Astro components. GSAP drives the loader wipe and entrance animations.

**Tech Stack:** Astro 7, Three.js 0.184, GSAP 3.15, Keystatic 0.5 (`@keystatic/astro` 5), `@astrojs/react` + `@astrojs/node` (Keystatic admin only), Vitest 4. Package manager: **pnpm 10**.

## Global Constraints

- Package manager is **pnpm** for every install/run command. Never use npm/yarn.
- Single public page only (`/`). No blog, no extra routes, no contact backend. (YAGNI)
- Public site must stay React-free; React is used solely to render the Keystatic admin panel.
- Monochrome only: all color comes from CSS custom properties that flip on `<html data-theme>`. No hardcoded hex in components.
- Layout fits one viewport (`100vh`, no page scroll) on desktop; collapses to one column on mobile without page scroll at normal heights.
- Respect `prefers-reduced-motion`: reduce/disable loader wipe and 3D motion when set.
- No theme flash on load: initial theme resolved by an inline `<head>` script before paint.
- Node v25 / pnpm 10 are installed. Commit after every task.

---

### Task 1: Scaffold Astro project, deps, and tooling

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/pages/index.astro` (placeholder), `src/env.d.ts`
- Already present: `.gitignore`, `docs/`

**Interfaces:**
- Produces: a runnable Astro dev server (`pnpm dev`) and a passing `pnpm test` command for later tasks.

- [ ] **Step 1: Initialize package.json and install dependencies**

Run (in `/Users/nyhzdev/dev/nyhz-dev`):
```bash
pnpm init
pnpm add astro@7 three@0.184 gsap@3.15 @keystatic/core@0.5 @keystatic/astro@5 @astrojs/react@6 @astrojs/node@11 react@19 react-dom@19
pnpm add -D vitest@4 @types/three@0.184 @types/node
```

- [ ] **Step 2: Write `package.json` scripts**

Merge these scripts into `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import keystatic from '@keystatic/astro';

// Static site by default; Keystatic admin/api routes opt into SSR via the
// node adapter. The public page (`/`) stays prerendered/static.
export default defineConfig({
  integrations: [react(), keystatic()],
  adapter: node({ mode: 'standalone' }),
});
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "types": ["astro/client", "@types/three"]
  }
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Write placeholder `src/pages/index.astro`**

```astro
---
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>nyhz</title></head>
  <body><main>scaffold ok</main></body>
</html>
```

- [ ] **Step 7: Verify dev server and Keystatic route boot**

Run: `pnpm dev` then in another shell `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/`
Expected: `200`. Also visit `http://localhost:4321/keystatic` in a browser — the Keystatic admin shell loads (it will error on missing config until Task 3; a rendered Keystatic page, not a 500, is enough here). Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro project with Three, GSAP, Keystatic, Vitest"
```

---

### Task 2: Theme controller (TDD)

**Files:**
- Create: `src/scripts/theme.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces:
  - `resolveInitialTheme(stored: string | null, prefersDark: boolean): 'dark' | 'light'`
  - `nextTheme(current: 'dark' | 'light'): 'dark' | 'light'`
  - `THEME_EVENT = 'themechange'` (string constant)
  - `applyTheme(mode: 'dark' | 'light'): void` — sets `document.documentElement.dataset.theme`, writes `localStorage`, dispatches a `CustomEvent(THEME_EVENT, { detail: mode })` on `window`. (Not unit-tested — DOM side effects; verified in Task 6.)
- Consumed by: ThemeToggle (Task 6), scene (Task 7), inline head script (Task 4).

- [ ] **Step 1: Write the failing test**

```ts
// tests/theme.test.ts
import { describe, it, expect } from 'vitest';
import { resolveInitialTheme, nextTheme, THEME_EVENT } from '../src/scripts/theme';

describe('resolveInitialTheme', () => {
  it('prefers a stored value over system', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });
  it('falls back to system when nothing stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });
  it('ignores invalid stored values', () => {
    expect(resolveInitialTheme('purple', true)).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('toggles', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});

describe('THEME_EVENT', () => {
  it('is a stable event name', () => {
    expect(THEME_EVENT).toBe('themechange');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../src/scripts/theme`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scripts/theme.ts
export type Theme = 'dark' | 'light';
export const THEME_EVENT = 'themechange';
const KEY = 'nyhz-theme';

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyTheme(mode: Theme): void {
  document.documentElement.dataset.theme = mode;
  try { localStorage.setItem(KEY, mode); } catch {}
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
}

export function readStoredTheme(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (3 suites).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/theme.ts tests/theme.test.ts
git commit -m "feat: theme resolution and toggle logic"
```

---

### Task 3: Keystatic CMS config + content data mapping (TDD for the mapping)

**Files:**
- Create: `keystatic.config.ts`
- Create: `src/scripts/content.ts` (reader wrapper + prop mappers)
- Create seed content: `src/content/profile.yaml`, `src/content/projects/sample-one.yaml`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces:
  - `type ProfileProps = { name: string; role: string; location: string; socials: { label: string; url: string }[] }`
  - `type ProjectProps = { slug: string; title: string; description: string; tags: string[]; repoUrl: string; order: number }`
  - `mapProfile(raw: unknown): ProfileProps` — applies fallbacks for missing fields.
  - `mapProjects(raw: { slug: string; entry: unknown }[]): ProjectProps[]` — maps + sorts by `order` ascending.
  - `getContent(): Promise<{ profile: ProfileProps; projects: ProjectProps[] }>` — uses Keystatic reader; not unit-tested (filesystem), called from `index.astro`.
- Consumed by: `index.astro` (Task 4), Identity, Projects.

- [ ] **Step 1: Write `keystatic.config.ts`**

```ts
import { config, fields, singleton, collection } from '@keystatic/core';

export default config({
  storage: { kind: 'local' },
  singletons: {
    profile: singleton({
      label: 'Profile',
      path: 'src/content/profile',
      format: { data: 'yaml' },
      schema: {
        name: fields.text({ label: 'Name' }),
        role: fields.text({ label: 'Role' }),
        location: fields.text({ label: 'Location' }),
        socials: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            url: fields.url({ label: 'URL' }),
          }),
          { label: 'Socials', itemLabel: (p) => p.fields.label.value },
        ),
      },
    }),
  },
  collections: {
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { data: 'yaml' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags', itemLabel: (p) => p.value,
        }),
        repoUrl: fields.url({ label: 'GitHub URL' }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
  },
});
```

- [ ] **Step 2: Write seed content**

`src/content/profile.yaml`:
```yaml
name: nyhz
role: creative developer
location: somewhere on earth
socials:
  - label: github
    url: https://github.com/nyhz
  - label: linkedin
    url: https://linkedin.com/
```

`src/content/projects/sample-one.yaml`:
```yaml
title: Sample One
description: A placeholder project. Edit me in Keystatic.
tags:
  - astro
  - three.js
repoUrl: https://github.com/nyhz
order: 1
```

- [ ] **Step 3: Write the failing test**

```ts
// tests/content.test.ts
import { describe, it, expect } from 'vitest';
import { mapProfile, mapProjects } from '../src/scripts/content';

describe('mapProfile', () => {
  it('maps a full profile', () => {
    const out = mapProfile({
      name: 'nyhz', role: 'dev', location: 'earth',
      socials: [{ label: 'github', url: 'https://x' }],
    });
    expect(out).toEqual({
      name: 'nyhz', role: 'dev', location: 'earth',
      socials: [{ label: 'github', url: 'https://x' }],
    });
  });
  it('applies fallbacks for missing/invalid fields', () => {
    const out = mapProfile({});
    expect(out.name).toBe('');
    expect(out.role).toBe('');
    expect(out.location).toBe('');
    expect(out.socials).toEqual([]);
  });
});

describe('mapProjects', () => {
  it('maps and sorts by order ascending', () => {
    const out = mapProjects([
      { slug: 'b', entry: { title: 'B', description: 'd', tags: ['t'], repoUrl: 'u', order: 2 } },
      { slug: 'a', entry: { title: 'A', description: 'd', tags: [], repoUrl: 'u', order: 1 } },
    ]);
    expect(out.map((p) => p.slug)).toEqual(['a', 'b']);
  });
  it('defaults order to 0 and tags to []', () => {
    const out = mapProjects([{ slug: 'a', entry: { title: 'A', description: 'd', repoUrl: 'u' } }]);
    expect(out[0].order).toBe(0);
    expect(out[0].tags).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../src/scripts/content`.

- [ ] **Step 5: Write implementation**

```ts
// src/scripts/content.ts
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

export type ProfileProps = {
  name: string; role: string; location: string;
  socials: { label: string; url: string }[];
};
export type ProjectProps = {
  slug: string; title: string; description: string;
  tags: string[]; repoUrl: string; order: number;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function mapProfile(raw: any): ProfileProps {
  return {
    name: str(raw?.name),
    role: str(raw?.role),
    location: str(raw?.location),
    socials: arr<any>(raw?.socials).map((s) => ({ label: str(s?.label), url: str(s?.url) })),
  };
}

export function mapProjects(items: { slug: string; entry: any }[]): ProjectProps[] {
  return items
    .map(({ slug, entry }) => ({
      slug,
      title: str(entry?.title),
      description: str(entry?.description),
      tags: arr<string>(entry?.tags).map(str),
      repoUrl: str(entry?.repoUrl),
      order: num(entry?.order),
    }))
    .sort((a, b) => a.order - b.order);
}

export async function getContent(): Promise<{ profile: ProfileProps; projects: ProjectProps[] }> {
  const reader = createReader(process.cwd(), keystaticConfig);
  const profileRaw = await reader.singletons.profile.read();
  const projectRaw = await reader.collections.projects.all();
  return {
    profile: mapProfile(profileRaw),
    projects: mapProjects(projectRaw.map((p) => ({ slug: p.slug, entry: p.entry }))),
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Verify Keystatic admin reads the schema**

Run: `pnpm dev`, open `http://localhost:4321/keystatic` — the Profile singleton and Projects collection appear and the seed entries are listed/editable. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add keystatic.config.ts src/scripts/content.ts src/content tests/content.test.ts
git commit -m "feat: Keystatic schema, seed content, and prop mappers"
```

---

### Task 4: Design tokens, base layout shell, and no-flash theme bootstrap

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/layouts/Base.astro`
- Modify: `src/pages/index.astro` (wire layout + data, render zones as empty placeholders for now)

**Interfaces:**
- Consumes: `getContent()` (Task 3), `resolveInitialTheme`/`readStoredTheme` semantics (Task 2).
- Produces: a `Base.astro` layout exposing named slots/regions: top bar (`<slot name="topbar" />`), left column (`<slot name="left" />`), right column (`<slot name="right" />`). CSS classes `.shell`, `.col-left`, `.col-right` consumed by later tasks.

- [ ] **Step 1: Write `src/styles/tokens.css`**

```css
:root {
  --bg: #0d0d0d;
  --fg: #f2f0eb;
  --muted: #8a8a85;
  --line: #2a2a2a;
  --particle: #f2f0eb;
  --space: clamp(1.25rem, 3vw, 3rem);
  --font: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
}
:root[data-theme='light'] {
  --bg: #ece9e2;
  --fg: #161513;
  --muted: #6b6b66;
  --line: #d3cfc6;
  --particle: #161513;
}
```

- [ ] **Step 2: Write `src/styles/global.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
html { background: var(--bg); color: var(--fg); font-family: var(--font);
  transition: background 0.5s ease, color 0.5s ease; }
body { overflow: hidden; }
a { color: inherit; text-decoration: none; }

.shell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas: "topbar topbar" "left right";
  height: 100vh; width: 100%;
  padding: var(--space);
  gap: var(--space);
}
.topbar { grid-area: topbar; display: flex; justify-content: space-between; align-items: center; }
.col-left { grid-area: left; display: flex; flex-direction: column; justify-content: center; gap: 2rem; }
.col-right { grid-area: right; position: relative; min-height: 0; }

@media (max-width: 720px) {
  .shell { grid-template-columns: 1fr; grid-template-rows: auto 38vh 1fr;
    grid-template-areas: "topbar" "right" "left"; }
  .col-left { justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  html { transition: none; }
}
```

- [ ] **Step 3: Write `src/layouts/Base.astro` with no-flash theme script**

```astro
---
const { title = 'nyhz' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <script is:inline>
      (function () {
        try {
          var s = localStorage.getItem('nyhz-theme');
          var t = (s === 'dark' || s === 'light') ? s
            : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          document.documentElement.dataset.theme = t;
        } catch (e) { document.documentElement.dataset.theme = 'dark'; }
      })();
    </script>
    <link rel="stylesheet" href="/src/styles/tokens.css" />
    <link rel="stylesheet" href="/src/styles/global.css" />
  </head>
  <body>
    <div class="shell">
      <header class="topbar"><slot name="topbar" /></header>
      <section class="col-left"><slot name="left" /></section>
      <section class="col-right"><slot name="right" /></section>
    </div>
    <slot name="overlay" />
  </body>
</html>
```

Note: import the CSS via ESM in components instead if Astro complains about the `/src/styles` href — replace the two `<link>` tags with `import '../styles/tokens.css'; import '../styles/global.css';` in the frontmatter. Prefer the import form.

- [ ] **Step 4: Wire `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { getContent } from '../scripts/content';
const { profile, projects } = await getContent();
---
<Base title={`${profile.name} — ${profile.role}`}>
  <span slot="topbar">{profile.name}</span>
  <div slot="left">
    <p>{profile.role}</p>
    <p>{profile.location}</p>
    <ul>{projects.map((p) => <li>{p.title}</li>)}</ul>
  </div>
  <div slot="right"></div>
</Base>
```

- [ ] **Step 5: Verify layout + no-flash + data**

Run: `pnpm dev`, open `http://localhost:4321/`. Confirm: page fills the viewport with no scrollbar; the seed name/role/location/projects render; reloading repeatedly shows no white/theme flash. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/styles src/layouts/Base.astro src/pages/index.astro
git commit -m "feat: design tokens, no-scroll layout shell, no-flash theme bootstrap"
```

---

### Task 5: Identity + ThemeToggle + socials (top bar and left column)

**Files:**
- Create: `src/components/Identity.astro`, `src/components/ThemeToggle.astro`, `src/components/Socials.astro`
- Modify: `src/pages/index.astro` (use the components)

**Interfaces:**
- Consumes: `ProfileProps` (Task 3); `applyTheme`, `readStoredTheme`, `resolveInitialTheme`, `nextTheme` (Task 2).
- `Identity.astro` props: `{ name: string; role: string; location: string }`.
- `Socials.astro` props: `{ socials: { label: string; url: string }[] }`.
- Produces: a working dark/light toggle that flips `<html data-theme>` and persists.

- [ ] **Step 1: Write `src/components/Identity.astro`**

```astro
---
const { name, role, location } = Astro.props;
---
<div class="identity" data-anim>
  <h1>hi, i'm {name}</h1>
  <p class="role">{role}</p>
  <p class="loc">{location}</p>
</div>
<style>
  .identity h1 { font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 600; letter-spacing: -0.02em; }
  .role { margin-top: 0.5rem; }
  .loc { color: var(--muted); }
</style>
```

- [ ] **Step 2: Write `src/components/Socials.astro`**

```astro
---
const { socials } = Astro.props;
---
<nav class="socials">
  {socials.map((s) => (
    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
  ))}
</nav>
<style>
  .socials { display: flex; gap: 1rem; }
  .socials a { color: var(--muted); transition: color 0.2s; }
  .socials a:hover { color: var(--fg); }
</style>
```

- [ ] **Step 3: Write `src/components/ThemeToggle.astro`**

```astro
<button class="theme-toggle" aria-label="Toggle theme" data-theme-toggle>
  <span class="dot"></span>
</button>
<style>
  .theme-toggle { background: none; border: 1px solid var(--line); border-radius: 999px;
    width: 2.4rem; height: 1.4rem; position: relative; cursor: pointer; padding: 0; }
  .dot { position: absolute; top: 50%; left: 0.2rem; width: 1rem; height: 1rem;
    border-radius: 50%; background: var(--fg); transform: translateY(-50%); transition: left 0.25s ease; }
  :root[data-theme='light'] .dot { left: calc(100% - 1.2rem); }
</style>
<script>
  import { applyTheme, nextTheme, readStoredTheme, resolveInitialTheme } from '../scripts/theme';
  const btn = document.querySelector('[data-theme-toggle]');
  const current = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  // Ensure storage matches the already-applied (no-flash) theme.
  applyTheme(resolveInitialTheme(readStoredTheme(), current() === 'dark'));
  btn?.addEventListener('click', () => applyTheme(nextTheme(current())));
</script>
```

- [ ] **Step 4: Wire components into `index.astro`**

Replace the topbar and left slots:
```astro
---
import Base from '../layouts/Base.astro';
import Identity from '../components/Identity.astro';
import Socials from '../components/Socials.astro';
import ThemeToggle from '../components/ThemeToggle.astro';
import { getContent } from '../scripts/content';
const { profile, projects } = await getContent();
---
<Base title={`${profile.name} — ${profile.role}`}>
  <span slot="topbar" class="wordmark">{profile.name}</span>
  <div slot="topbar" class="topbar-right">
    <ThemeToggle />
    <Socials socials={profile.socials} />
  </div>
  <Fragment slot="left">
    <Identity name={profile.name} role={profile.role} location={profile.location} />
  </Fragment>
  <div slot="right"></div>
</Base>
```

Note: the top bar has two `slot="topbar"` children; if Astro requires a single node per named slot, wrap them in one `<div slot="topbar" class="topbar">` containing both the wordmark and the `.topbar-right` group, and move the existing `.topbar` flex styles onto that wrapper.

- [ ] **Step 5: Verify toggle works**

Run: `pnpm dev`, open `/`. Click the toggle: colors flip between dark/light smoothly, the knob slides, and the choice survives reload. Confirm no scrollbar. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/components/Identity.astro src/components/Socials.astro src/components/ThemeToggle.astro src/pages/index.astro
git commit -m "feat: identity block, socials, and dark/light toggle"
```

---

### Task 6: Projects list with hover interaction

**Files:**
- Create: `src/components/Projects.astro`
- Modify: `src/pages/index.astro` (render Projects in the left column)

**Interfaces:**
- Consumes: `ProjectProps[]` (Task 3).
- `Projects.astro` props: `{ projects: ProjectProps[] }`. Renders at most the first 4 (single-viewport constraint); if more exist, the extras are not shown.

- [ ] **Step 1: Write `src/components/Projects.astro`**

```astro
---
const { projects } = Astro.props;
const shown = projects.slice(0, 4);
---
<div class="projects" data-anim>
  <p class="label">— selected work</p>
  <ul>
    {shown.map((p, i) => (
      <li class="row">
        <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">
          <span class="idx">{String(i + 1).padStart(2, '0')}</span>
          <span class="name">{p.title}</span>
          <span class="tags">{p.tags.join(' · ')}</span>
          <span class="arrow">→</span>
        </a>
      </li>
    ))}
  </ul>
</div>
<style>
  .label { color: var(--muted); margin-bottom: 0.75rem; font-size: 0.85rem; }
  .projects ul { list-style: none; }
  .row a { display: grid; grid-template-columns: auto 1fr auto auto; align-items: baseline;
    gap: 1rem; padding: 0.55rem 0; border-bottom: 1px solid var(--line);
    transition: padding-left 0.25s ease, color 0.25s ease; }
  .row a:hover { padding-left: 0.6rem; }
  .idx { color: var(--muted); font-variant-numeric: tabular-nums; }
  .row a:hover .name { font-weight: 600; }
  .tags { color: var(--muted); font-size: 0.8rem; }
  .arrow { opacity: 0; transform: translateX(-6px); transition: opacity 0.25s, transform 0.25s; }
  .row a:hover .arrow { opacity: 1; transform: translateX(0); }
  @media (prefers-reduced-motion: reduce) {
    .row a, .arrow { transition: none; }
  }
</style>
```

- [ ] **Step 2: Render in `index.astro` left column**

Add the import and place `<Projects projects={projects} />` directly after `<Identity ... />` inside the `left` slot fragment.

- [ ] **Step 3: Verify hover + links**

Run: `pnpm dev`, open `/`. Hover rows: row nudges right, arrow fades in, name bolds, underline present. Click opens the repo URL in a new tab. Still no scroll. Toggle theme — rows restyle correctly. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/Projects.astro src/pages/index.astro
git commit -m "feat: projects list with hover interaction and GitHub links"
```

---

### Task 7: 3D particle centerpiece (Three.js)

**Files:**
- Create: `src/scripts/displace.ts` (pure math helpers, TDD)
- Create: `src/scripts/scene.ts` (Three.js setup + loop)
- Create: `src/components/Scene.astro` (canvas + island script)
- Modify: `src/pages/index.astro` (mount Scene in the right column)
- Test: `tests/displace.test.ts`

**Interfaces:**
- Produces:
  - `displace.ts`: `repel(point: [number,number,number], pointer: [number,number,number], radius: number, strength: number): [number,number,number]` — returns a displacement vector; zero when beyond `radius`.
  - `scene.ts`: `createScene(canvas: HTMLCanvasElement): { setTheme(color: string): void; dispose(): void; start(): void }`.
- Consumes: `THEME_EVENT` (Task 2), `--particle` CSS var for color.

- [ ] **Step 1: Write the failing test for `displace.ts`**

```ts
// tests/displace.test.ts
import { describe, it, expect } from 'vitest';
import { repel } from '../src/scripts/displace';

describe('repel', () => {
  it('returns zero displacement beyond radius', () => {
    expect(repel([0, 0, 0], [10, 0, 0], 1, 1)).toEqual([0, 0, 0]);
  });
  it('pushes away from the pointer when inside radius', () => {
    const [dx] = repel([0.5, 0, 0], [0, 0, 0], 2, 1);
    expect(dx).toBeGreaterThan(0); // point is +x of pointer, so pushed further +x
  });
  it('stronger push when closer', () => {
    const near = repel([0.2, 0, 0], [0, 0, 0], 2, 1)[0];
    const far = repel([1.5, 0, 0], [0, 0, 0], 2, 1)[0];
    expect(near).toBeGreaterThan(far);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../src/scripts/displace`.

- [ ] **Step 3: Implement `src/scripts/displace.ts`**

```ts
export type Vec3 = [number, number, number];

export function repel(point: Vec3, pointer: Vec3, radius: number, strength: number): Vec3 {
  const dx = point[0] - pointer[0];
  const dy = point[1] - pointer[1];
  const dz = point[2] - pointer[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius || dist === 0) return [0, 0, 0];
  const falloff = (1 - dist / radius) * strength;
  return [(dx / dist) * falloff, (dy / dist) * falloff, (dz / dist) * falloff];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Implement `src/scripts/scene.ts`**

```ts
import * as THREE from 'three';
import { repel, type Vec3 } from './displace';

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4;

  // Particles distributed on an icosahedron surface.
  const geo = new THREE.IcosahedronGeometry(1.3, 12);
  const base = geo.attributes.position.array.slice() as unknown as Float32Array;
  const positions = new Float32Array(base);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const material = new THREE.PointsMaterial({ size: 0.02, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  const pointer: Vec3 = [100, 100, 100];
  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    pointer[0] = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer[1] = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer[2] = 0;
  }
  function onLeave() { pointer[0] = pointer[1] = pointer[2] = 100; }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function setColor(color: string) { material.color.set(color); }

  let raf = 0;
  let t = 0;
  function frame() {
    t += 0.01;
    if (!reduceMotion) points.rotation.y = t * 0.15;
    for (let i = 0; i < positions.length; i += 3) {
      const bx = base[i], by = base[i + 1], bz = base[i + 2];
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t + bx * 2 + by * 2) * 0.03;
      const [ox, oy, oz] = repel([bx, by, bz], pointer, 0.7, 0.5);
      positions[i] = bx * breathe + ox;
      positions[i + 1] = by * breathe + oy;
      positions[i + 2] = bz * breathe + oz;
    }
    geo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    start() { raf = requestAnimationFrame(frame); },
    setTheme(color: string) { setColor(color); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      geo.dispose(); material.dispose(); renderer.dispose();
    },
  };
}
```

- [ ] **Step 6: Write `src/components/Scene.astro`**

```astro
<canvas class="scene" aria-hidden="true"></canvas>
<style>
  .scene { width: 100%; height: 100%; display: block; }
</style>
<script>
  import { createScene } from '../scripts/scene';
  import { THEME_EVENT } from '../scripts/theme';
  const canvas = document.querySelector('canvas.scene') as HTMLCanvasElement | null;
  if (canvas) {
    const ok = (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })();
    if (!ok) { canvas.style.display = 'none'; }
    else {
      const particleColor = () => getComputedStyle(document.documentElement).getPropertyValue('--particle').trim() || '#f2f0eb';
      const s = createScene(canvas);
      s.setTheme(particleColor());
      s.start();
      window.addEventListener(THEME_EVENT, () => s.setTheme(particleColor()));
    }
  }
</script>
```

- [ ] **Step 7: Mount in `index.astro` right column**

Import `Scene` and replace `<div slot="right"></div>` with `<Scene slot="right" />`.

- [ ] **Step 8: Verify the 3D piece**

Run: `pnpm dev`, open `/`. Confirm: particle form renders in the right column, breathes/rotates slowly, particles push away from the cursor and return, color matches theme and updates when toggling. Check the console for errors. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add src/scripts/displace.ts src/scripts/scene.ts src/components/Scene.astro src/pages/index.astro tests/displace.test.ts
git commit -m "feat: interactive Three.js particle centerpiece"
```

---

### Task 8: Animated loader + entrance orchestration (GSAP)

**Files:**
- Create: `src/components/Loader.astro`
- Modify: `src/pages/index.astro` (add Loader to the `overlay` slot)
- Modify: `src/components/Identity.astro`, `src/components/Projects.astro` (already carry `data-anim`; ensure initial hidden state)

**Interfaces:**
- Consumes: elements marked `[data-anim]` for the staggered entrance.
- Produces: on completion dispatches `window` event `loaderdone`; Scene start is gated so the 3D becomes visible as the wipe reveals.

- [ ] **Step 1: Write `src/components/Loader.astro`**

```astro
---
const { name } = Astro.props;
---
<div class="loader" data-loader>
  <span class="loader-word">{name}</span>
  <span class="loader-count" data-count>0</span>
</div>
<style>
  .loader { position: fixed; inset: 0; z-index: 100; background: var(--bg); color: var(--fg);
    display: flex; align-items: flex-end; justify-content: space-between;
    padding: var(--space); will-change: transform; }
  .loader-count { font-variant-numeric: tabular-nums; color: var(--muted); }
  [data-anim] { opacity: 0; transform: translateY(12px); }
</style>
<script>
  import { gsap } from 'gsap';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loader = document.querySelector('[data-loader]') as HTMLElement;
  const count = document.querySelector('[data-count]') as HTMLElement;
  const anims = gsap.utils.toArray('[data-anim]') as HTMLElement[];

  function reveal() {
    gsap.to(anims, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
    window.dispatchEvent(new Event('loaderdone'));
  }

  if (reduce) {
    loader.style.display = 'none';
    reveal();
  } else {
    const tl = gsap.timeline();
    tl.to({ v: 0 }, { v: 100, duration: 1.1, ease: 'power1.inOut',
      onUpdate() { count.textContent = String(Math.round(this.targets()[0].v)); } });
    tl.to(loader, { yPercent: -100, duration: 0.8, ease: 'power3.inOut' }, '+=0.1');
    tl.add(reveal, '-=0.4');
  }
</script>
```

- [ ] **Step 2: Add Loader to `index.astro`**

Import `Loader` and add `<Loader name={profile.name} slot="overlay" />` inside `<Base>`.

- [ ] **Step 3: Verify loader + entrance**

Run: `pnpm dev`, open `/`. Confirm: loader covers the screen, counter runs 0→100, curtain wipes up, identity + projects stagger in, 3D is visible underneath. Toggle OS reduced-motion (or emulate in devtools) and reload: loader is skipped, content visible immediately. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/Loader.astro src/pages/index.astro
git commit -m "feat: animated loader with GSAP wipe and staggered entrance"
```

---

### Task 9: Final polish, build verification, and README

**Files:**
- Create: `README.md`
- Modify: any component needing a fix surfaced by the build (e.g. duplicate slot wrapper from Task 5 note).

**Interfaces:** none new — this task hardens existing work.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all suites PASS (theme, content, displace).

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: build succeeds with no errors. If the duplicate `slot="topbar"` note from Task 5 caused a warning/error, apply the single-wrapper fix now and rebuild.

- [ ] **Step 3: Preview the production build**

Run: `pnpm preview`, open the shown URL. Re-verify: no scroll, loader plays, 3D interactive, projects hover, theme toggle persists across reloads, both themes look correct. Stop the server.

- [ ] **Step 4: Write `README.md`**

```markdown
# nyhz-dev

Minimal single-view portfolio. Astro + Three.js + GSAP, content via Keystatic (git-based CMS).

## Develop
- `pnpm dev` — site at http://localhost:4321, CMS at http://localhost:4321/keystatic
- `pnpm test` — unit tests (theme, content, displacement)
- `pnpm build` / `pnpm preview` — production build

## Edit content
Open `/keystatic` locally. Profile (name, role, location, socials) and Projects
(title, description, tags, GitHub URL, order) write back to `src/content/` as YAML.
```

- [ ] **Step 5: Commit**

```bash
git add README.md src
git commit -m "chore: polish, production build verification, and README"
```

---

## Self-Review

**Spec coverage:**
- Single-page no-scroll layout → Tasks 4, 6 (`body{overflow:hidden}`, `100vh` grid). ✓
- Inspired-by-not-copy structure → Task 4 two-column reorg. ✓
- Animated loader → Task 8. ✓
- Identity (name/role/location) → Tasks 3, 5. ✓
- 3D centerpiece replacing photos → Task 7. ✓
- Projects with GitHub links + hover → Task 6. ✓
- Dark/light switch, no flash, persisted → Tasks 2, 4, 5. ✓
- Git-based CMS (Keystatic) → Task 3. ✓
- Reduced-motion + WebGL fallback → Tasks 6, 7, 8. ✓
- Tests for theme + CMS data shape → Tasks 2, 3 (+ displacement in 7). ✓
- pnpm everywhere → all tasks. ✓

**Placeholder scan:** No TBD/TODO; every code step includes concrete code. Two explicit "Note" branches (CSS import form; single-slot wrapper) give the engineer a deterministic fallback rather than a vague instruction. ✓

**Type consistency:** `ProfileProps`/`ProjectProps` defined in Task 3 and consumed unchanged in Tasks 4–6. `createScene` returns `{ start, setTheme, dispose }` (Task 7) and Scene.astro uses exactly those. `THEME_EVENT`/`applyTheme`/`nextTheme`/`resolveInitialTheme`/`readStoredTheme` defined in Task 2, consumed consistently in Tasks 5, 7. `repel` signature identical in test and implementation. ✓
