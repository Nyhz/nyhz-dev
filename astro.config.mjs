import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';

// Deployed on Vercel. The public page (`/`) is prerendered/static; the server
// routes (contact, activity, status) run as serverless functions.
// `site` powers canonical URLs, Open Graph absolute paths, and the sitemap.
// Keystatic (and the React it needs) is the local editor only: with local
// storage its admin and write API have no auth, so they're never deployed.
// The build reads the content straight from the files (scripts/content.ts).
const dev = process.argv.includes('dev');

// The adapter emits its long-cache rule for /_astro/* after the `filesystem`
// handle, where Vercel never applies it to the files themselves — they went
// out with max-age=0. Move header rules ahead of it, and give the covers
// (plain names, not hashed, so not immutable) a day.
const vercelCacheHeaders = {
  name: 'vercel-cache-headers',
  hooks: {
    'astro:build:done': async () => {
      const file = new URL('./.vercel/output/config.json', import.meta.url);
      let config;
      try { config = JSON.parse(await readFile(file, 'utf8')); } catch { return; }
      const fs = config.routes.findIndex((r) => r.handle === 'filesystem');
      if (fs < 0) return;
      const headers = config.routes.filter((r, i) => i > fs && r.headers && r.continue);
      headers.push({ src: '^/projects/(.*)$', headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' }, continue: true });
      config.routes = [...headers, ...config.routes.filter((r) => !headers.includes(r))];
      await writeFile(file, JSON.stringify(config, null, '\t'));
    },
  },
};

// Each code line carries its own indent (--lead, in columns), so when a long
// line wraps, what wraps can hang further in than the line it belongs to.
const hang = {
  name: 'hang',
  line(node) {
    const text = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(text).join(''));
    const lead = text(node).match(/^ */)[0].length;
    if (lead) node.properties.style = `--lead: ${lead}`;
  },
};

export default defineConfig({
  site: 'https://www.nyhz.dev',
  integrations: [...(dev ? [react(), keystatic()] : []), sitemap(), vercelCacheHeaders],
  // Vercel Web Analytics: cookieless, so no banner. Its script counts the
  // client router's navigations too (it follows pushState and popstate)
  adapter: vercel({ webAnalytics: { enabled: true } }),
  // the lab's posts (src/content/lab/*.md): code in a dark theme that keeps AA
  // contrast, and long lines wrap instead of scrolling sideways
  markdown: { shikiConfig: { theme: 'github-dark-default', wrap: true, transformers: [hang] } },
});
