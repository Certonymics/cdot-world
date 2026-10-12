/* /sitemap.xml - generated from the pages that exist, so a new page is listed
   without anyone remembering to add it, and a removed one drops out.

   The site was a single page and had no sitemap. It has one now because a
   sitemap is also how a crawler learns when the content last changed: <lastmod>
   is the date of the last content commit (src/lib/lastmod.mjs), the same value
   the WebPage's dateModified carries. `npm run check:seo` fails if this file
   lists a noindex page, omits an indexable one, or disagrees with robots.txt. */
import { lastModified } from "../lib/lastmod.mjs";

/* Pages that must not be listed (they are noindex). Everything else in
   src/pages/*.astro is a destination. */
const EXCLUDED = new Set(["404"]);

const pages = Object.keys(import.meta.glob("./*.astro"))
  .map((p) => p.replace(/^\.\//, "").replace(/\.astro$/, ""))
  .filter((name) => !EXCLUDED.has(name))
  .sort();

export function GET({ site }: { site: URL }) {
  const lastmod = lastModified();
  const urls = pages
    .map((name) => {
      const path = name === "index" ? "/" : `/${name}/`;
      return `  <url>\n    <loc>${new URL(path, site).href}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
