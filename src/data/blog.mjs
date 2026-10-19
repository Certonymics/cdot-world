/* ---------------------------------------------------------------------------
   The Blog - on/off switch and where its content comes from.

   The Blog is WIRED but OFF. While BLOG_LIVE is false the site contains no blog
   page, no /blog URL, no sitemap or llms.txt entry, and the build makes no
   request to Sanity. The footer shows "Blog" as a "Coming soon" label.

   TO TURN IT ON
     1. Put the Sanity project id below (it is public; see src/lib/sanity.js).
     2. Set BLOG_LIVE to true.
     3. Publish at least one article in the Studio, then push to main.
   See "The Blog" in README.md for the full checklist, including the webhook that
   rebuilds the site when you publish.

   To PREVIEW it without turning it on for everyone, build with the environment
   variable BLOG_LIVE=1 (locally, or set on Cloudflare Pages' Preview environment
   only). The environment variable wins over the constant in either direction.
--------------------------------------------------------------------------- */

export const BLOG_LIVE_DEFAULT = false;

const env = (k) => (typeof process !== "undefined" ? process.env[k] : undefined);

export const blogLive = env("BLOG_LIVE") ? env("BLOG_LIVE") === "1" : BLOG_LIVE_DEFAULT;

/* The Sanity project. The id is not a secret: it is in every request the
   Studio makes, and the dataset is public-read, so there is no token. */
export const SANITY_PROJECT_ID = "upmwu9hm"; /* <- paste the project id here (and in studio/) */

export const sanity = {
  projectId: env("SANITY_PROJECT_ID") || SANITY_PROJECT_ID,
  dataset: env("SANITY_DATASET") || "production",
  apiVersion: "2024-01-01",
};

export const blogPath = "/blog/";
