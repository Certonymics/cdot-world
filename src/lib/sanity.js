/* Blog content, read from Sanity at BUILD time.

   The dataset is public-read, so there is no token and nothing secret in this
   file. Authoring happens in the Studio in studio/; this site only reads. No
   browser ever talks to Sanity: pages are rendered to static HTML, which is why
   no CORS origin has to be registered for cdot.world.

   Production builds go to the live API rather than the CDN, so a deploy triggered
   right after publishing cannot ship stale content. Dev uses the CDN, which is
   faster and fine for previewing.

   Nothing here runs while the Blog is off (src/data/blog.mjs): getArticles()
   returns [] without touching the network. */
import { blogLive, sanity } from "../data/blog.mjs";

const host = import.meta.env.PROD ? "api.sanity.io" : "apicdn.sanity.io";

/* One query for everything: the listing, the article pages, the "related" list,
   the sitemap and llms.txt all need the same data. */
const QUERY = `
  *[_type == "article"] | order(coalesce(publishedAt, _createdAt) desc) {
    "slug": slug.current,
    title,
    excerpt,
    "date": publishedAt,
    "published": coalesce(publishedAt, _createdAt),
    "modified": coalesce(_updatedAt, publishedAt, _createdAt),
    readTime,
    "cover": coverImage{
      alt,
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height
    },
    body[]{
      ...,
      _type == "image" => {
        ...,
        "asset": asset->{
          url,
          "width": metadata.dimensions.width,
          "height": metadata.dimensions.height
        }
      }
    }
  }
`;

/**
 * One article from the Studio's `article` type.
 * @typedef {Object} Article
 * @property {string} slug
 * @property {string} title
 * @property {string} [excerpt]
 * @property {string | null} [date] publishedAt
 * @property {string} published publishedAt, else the creation date
 * @property {string} modified
 * @property {string | null} [readTime]
 * @property {{alt?: string|null, url?: string|null, width?: number|null, height?: number|null} | null} [cover]
 * @property {any[] | null} [body] Portable Text blocks
 */

/** @type {Promise<Article[]> | undefined} */
let cached;

/** @returns {Promise<Article[]>} */
async function load() {
  if (!sanity.projectId)
    throw new Error(
      "The Blog is on (src/data/blog.mjs) but no Sanity project id is set. " +
        "Fill in sanity.projectId there, or set SANITY_PROJECT_ID.",
    );
  const url =
    `https://${sanity.projectId}.${host}/v${sanity.apiVersion}/data/query/${sanity.dataset}` +
    `?query=${encodeURIComponent(QUERY)}`;
  let articles;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    articles = (await res.json()).result ?? [];
  } catch (err) {
    if (process.env.ALLOW_EMPTY_CMS) return [];
    throw new Error(
      `Could not fetch the Blog from Sanity (${err.message}). Refusing to build: ` +
        `the section would ship empty and its URLs would silently drop out of the ` +
        `sitemap. Set ALLOW_EMPTY_CMS=1 to build anyway.`,
    );
  }
  /* A reachable but empty dataset loses the same pages as an outage. */
  if (articles.length === 0 && !process.env.ALLOW_EMPTY_CMS) {
    throw new Error("Sanity returned 0 articles. Refusing to build - see ALLOW_EMPTY_CMS.");
  }
  return articles;
}

/**
 * All articles, newest first. Fetched once per build; [] while the Blog is off.
 * @returns {Promise<Article[]>}
 */
export function getArticles() {
  if (!blogLive) return Promise.resolve([]);
  if (!import.meta.env.PROD) return load();
  return (cached ??= load());
}

/**
 * Up to three other articles, newest first.
 * @param {Article[]} articles
 * @param {string} slug
 */
export function relatedTo(articles, slug) {
  return articles.filter((a) => a.slug !== slug).slice(0, 3);
}

/**
 * Date and read time are both optional in Sanity, so show only what is set.
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
export function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** @param {Article} article */
export function byline(article) {
  return [formatDate(article.date), article.readTime].filter(Boolean).join(" · ");
}
