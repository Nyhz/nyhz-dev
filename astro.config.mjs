import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import keystatic from '@keystatic/astro';

// Deployed on Vercel. The public page (`/`) is prerendered/static; the server
// routes (the contact API, Keystatic admin/api) run as serverless functions.
export default defineConfig({
  integrations: [react(), keystatic()],
  adapter: vercel(),
});
