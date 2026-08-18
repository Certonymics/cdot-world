// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.cdot.world',
  // No integrations: this site ships zero client-side framework code. The only
  // JS on the page is the two inline scripts in index.astro plus landdots.js.
});
