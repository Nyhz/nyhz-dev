import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';

// Deployed on Vercel. The public page (`/`) is prerendered/static; the server
// routes (the contact API, Keystatic admin/api) run as serverless functions.
// `site` powers canonical URLs, Open Graph absolute paths, and the sitemap.
export default defineConfig({
  site: 'https://www.nyhz.dev',
  integrations: [react(), keystatic(), sitemap()],
  adapter: vercel(),
});
