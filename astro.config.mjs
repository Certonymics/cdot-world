// @ts-check
import { defineConfig } from 'astro/config';
import { blogLive } from './src/data/blog.mjs';

/* The Blog. Its two page templates live in src/blog/, NOT src/pages/, and are
   added as routes only while the Blog is on (src/data/blog.mjs). While it is off
   there is no /blog page, nothing in the sitemap, and no request to Sanity. */
const blog = {
  name: 'cdot-blog',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      if (!blogLive) return;
      injectRoute({ pattern: '/blog', entrypoint: './src/blog/index.astro' });
      injectRoute({ pattern: '/blog/[slug]', entrypoint: './src/blog/article.astro' });
    },
  },
};

export default defineConfig({
  site: 'https://cdot.world',
  integrations: [blog],
  // Blog images live in Sanity. Listing the host lets the build download and
  // optimise them into /_astro/, so visitors load every image from this origin
  // and never contact cdn.sanity.io. Nothing is fetched while the Blog is off.
  image: { domains: ['cdn.sanity.io'] },
  // The only JS in the output is the inline contact-form handler in index.astro and
  // public/assets/map.js. Neither is bundled by Astro, so there is no client
  // runtime in the output. The sitemap is src/pages/sitemap.xml.ts rather than
  // @astrojs/sitemap, to keep the dependency list short too.
});
