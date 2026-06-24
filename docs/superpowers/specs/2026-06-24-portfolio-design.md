# nyhz-dev — Minimal single-view portfolio

**Date:** 2026-06-24
**Status:** Approved design, pre-implementation

## Goal

A single-page, no-scroll personal portfolio inspired by [concrete.codes](https://www.concrete.codes/) — hyper-minimal, monochrome (black & white), interaction-driven. Reuses the *structure* of the reference (identity header, projects list) but reorganizes it into a compact two-column layout, replaces its cat photos with an interactive 3D centerpiece, and adds an animated loader and a dark/light switch. All textual content is editable through a git-based CMS.

## Stack

- **Astro** — static site base, ships ~0 JS except the islands below. Package manager: **pnpm**.
- **Three.js** — the interactive 3D piece, mounted in a `<canvas>` client island.
- **GSAP** — loader animation, staggered content entrance, hover micro-interactions.
- **Keystatic** — git-based CMS. Edits write markdown/yaml into the repo. Admin UI runs locally at `/keystatic`. Requires `@astrojs/react` (only used to render Keystatic's panel — the public site stays React-free).

## Architecture

```
nyhz-dev/
├─ astro.config.mjs        Astro + Keystatic + React integration
├─ keystatic.config.ts     CMS schema: "profile" singleton + "projects" collection
├─ src/
│  ├─ content/             CMS-generated content (in git)
│  │  ├─ profile.yaml      name, role, location, social links
│  │  └─ projects/         one entry per project
│  ├─ pages/index.astro    The only public page (100vh, no scroll)
│  ├─ components/
│  │  ├─ Loader.astro      Animated overlay, GSAP wipe reveal
│  │  ├─ Identity.astro    Greeting, name, role, location, socials
│  │  ├─ Projects.astro    Compact hover list, GitHub links
│  │  ├─ ThemeToggle.astro Dark/light switch
│  │  └─ scene.ts          Three.js particle piece (canvas island)
│  └─ styles/
│     ├─ tokens.css        Color/space/type tokens as CSS vars (theme-aware)
│     └─ global.css        Reset + base layout
└─ tests/                  Vitest: theme logic + CMS data shape
```

### Units & responsibilities

- **`scene.ts`** — owns the Three.js renderer, the particle object, the pointer-repulsion + noise animation, and a `setTheme(mode)` method that interpolates particle color. Depends only on a target `<canvas>` and the `prefers-color-scheme` / theme state. Testable boundary: exported pure helpers for the displacement math; the WebGL loop itself is not unit-tested.
- **`theme.ts`** (small util) — resolves initial theme (localStorage → system), toggles, persists, and emits a `themechange` event. Pure and unit-tested.
- **`Loader.astro`** — self-contained overlay + GSAP timeline; on complete, fires an event that triggers content entrance and `scene` start.
- **CMS data** — `index.astro` reads `profile` + `projects` via Astro content collections backed by Keystatic. Components receive plain props; they don't know about Keystatic.

## Layout (single viewport, no scroll)

Asymmetric two columns inside `100vh`:

```
┌───────────────────────────────────────────────────────────┐
│  nyhz                                    ☾/☀  github  in    │  top bar
│                                                             │
│   hi, i'm [name]                ╭───────────────────────╮   │
│   creative developer            │                       │   │
│   [location]                    │     3D PARTICLE        │   │
│                                 │     PIECE (canvas,     │   │
│   — selected work               │     cursor-reactive)   │   │
│   01  project-a       →         │                       │   │
│   02  project-b       →         ╰───────────────────────╯   │
│   03  project-c       →                                     │
│   04  project-d       →                                     │
└───────────────────────────────────────────────────────────┘
   left: identity + projects            right: 3D
```

- Left column: identity block + compact "selected work" list (3–4 projects to fit one viewport).
- Right column: the 3D canvas, full column height.
- Top bar: wordmark left; theme toggle + social icons right.
- **Mobile:** collapses to one column (3D reduced on top, text below); stays within viewport at normal heights.

## 3D centerpiece

A **monochrome particle icosahedron/sphere** rendered with Three.js `Points`:

- Particles distributed on a sphere/icosahedron surface, displaced by a noise shader so the form "breathes" slowly.
- Pointer repulsion: particles near the cursor push away and return elastically.
- Theme-aware: dark = light particles on near-black; light = dark particles on bone. Color interpolates on theme change.
- Performance: single draw call (`Points`), `requestAnimationFrame` paused when tab hidden, capped DPR.

## Loader

- Full-screen overlay shown immediately (no theme flash — inline head script sets theme first).
- Displays wordmark + load progress.
- On ready, GSAP timeline runs a mask/curtain wipe that reveals the scene, then staggers in the identity text and project rows and starts the 3D loop.

## Projects hover

- Each row: index number + name + arrow. On hover: row shifts slightly, arrow `→` reveals, an underline extends, number weight changes.
- Click opens the project's GitHub repo in a new tab (`target="_blank" rel="noopener"`).

## Theming

- CSS custom properties switch on a `data-theme` attribute on `<html>`.
- Initial theme resolved by inline `<head>` script (localStorage → system) before paint — no flash.
- Toggle persists to `localStorage` and emits `themechange`; `scene.ts` listens and interpolates particle color.

## CMS schema (Keystatic)

- **profile** (singleton): `name`, `role`, `location`, `socials` (list of `{label, url}`).
- **projects** (collection): per entry `title`, `description` (short), `tags` (list), `repoUrl`, `order`.

## Error handling

- Missing/empty CMS data → components render graceful fallbacks (e.g. empty work list shows nothing rather than crashing).
- WebGL unsupported → canvas hidden, layout unaffected (3D is decorative).
- Reduced motion (`prefers-reduced-motion`) → loader skips the elaborate wipe and the 3D reduces motion amplitude.

## Testing

- **Vitest** unit tests for `theme.ts` (resolution, toggle, persistence) and for the CMS data shape/parsing (profile + projects load and map to props).
- No automated visual/WebGL tests — the 3D loop is verified manually in-browser.

## Out of scope (YAGNI)

- Blog, multiple pages, contact form backend, analytics, i18n. Single page only.

## Open content note

`profile.yaml` and project entries ship with placeholder values; real name/location/projects are filled via the Keystatic CMS by the owner.
