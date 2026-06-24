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
