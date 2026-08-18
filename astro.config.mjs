// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.cdot.world',
  // No integrations: this site ships zero client-side framework code. The only
  // JS on the page is the two inline scripts in index.astro (contact form, map).
  // No sitemap integration either - a single page at the domain root needs none.
});
