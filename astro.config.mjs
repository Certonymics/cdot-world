// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://cdot.world',
  // No integrations: this site ships zero client-side framework code. The only
  // JS is the inline contact-form handler in index.astro and public/assets/map.js.
  // Neither is bundled by Astro, so there is no client runtime in the output.
  // No sitemap integration either - a single page at the domain root needs none.
});
