/* Sanity Portable Text -> HTML, for article bodies.
 *
 * Done with @portabletext/to-html rather than by hand: lists nest, marks nest,
 * and every piece of CMS text has to be escaped. Blocks and lists use the
 * library's defaults (<p>, <h2>, <h3>, <ul>, <ol>); the page styles the output.
 *
 * Only what the Studio's article schema can produce is handled: normal / h2 /
 * h3, strong / em / link, bulleted and numbered lists, and the two custom
 * objects, callout and image.
 */
import { toHTML, escapeHTML, uriLooksSafe } from "@portabletext/to-html";
import { getImage } from "astro:assets";

/* Body images are fetched and optimised at build time, so they are served from
   this origin like everything else. Keyed by the Sanity asset URL. */
async function resolveImages(body) {
  const sources = body.filter((b) => b._type === "image" && b.asset?.url);
  const entries = await Promise.all(
    sources.map(async ({ asset }) => {
      const width = Math.min(asset.width, 1440);
      const height = Math.round((width * asset.height) / asset.width);
      const img = await getImage({
        src: asset.url,
        width,
        height,
        widths: [720, 1440].filter((w) => w <= asset.width),
        format: "webp",
      });
      return [asset.url, { img, width, height }];
    }),
  );
  return new Map(entries);
}

export async function renderBody(body) {
  if (!body?.length) return "";
  const images = await resolveImages(body);

  return toHTML(body, {
    components: {
      marks: {
        link: ({ children, value }) => {
          const href = value?.href;
          if (!href || !uriLooksSafe(href)) return children;
          const blank = value.blank ? ' target="_blank" rel="noopener noreferrer"' : "";
          return `<a href="${escapeHTML(href)}"${blank}>${children}</a>`;
        },
      },
      types: {
        callout: ({ value }) => `<aside class="callout"><p>${escapeHTML(value.text ?? "")}</p></aside>`,
        image: ({ value }) => {
          const hit = images.get(value.asset?.url);
          if (!hit) return "";
          const { img, width, height } = hit;
          const srcset = img.srcSet.attribute ? ` srcset="${escapeHTML(img.srcSet.attribute)}"` : "";
          return (
            `<img src="${escapeHTML(img.src)}"${srcset} sizes="(max-width: 860px) 100vw, 720px" ` +
            `alt="${escapeHTML(value.alt ?? "")}" width="${width}" height="${height}" ` +
            `loading="lazy" decoding="async">`
          );
        },
      },
    },
  });
}
