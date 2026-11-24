// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  devToolbar: { enabled: false },
  // Schutz gegen fremde Formular-POSTs (Standard, hier nur sichtbar gemacht)
  security: { checkOrigin: true },
});
