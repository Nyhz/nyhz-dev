# nyhz-dev

Minimal single-view portfolio. Astro + Three.js + GSAP, content via Keystatic (git-based CMS).

## Develop
- `pnpm dev` — site at http://localhost:4321, CMS at http://localhost:4321/keystatic
- `pnpm test` — unit tests (theme, content, displacement)
- `pnpm build` / `pnpm preview` — production build

## Edit content
Open `/keystatic` locally. Profile (name, role, location, socials) and Projects
(title, description, tags, GitHub URL, order) write back to `src/content/` as YAML.
