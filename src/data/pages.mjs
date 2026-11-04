/* ---------------------------------------------------------------------------
   The text pages (privacy, terms): each page's name, title, description and
   date, written ONCE. The page files read their <title>/description from here,
   and /llms.txt builds its "Pages" list from here, so a page's description is
   the same in its meta tags and in llms.txt and cannot drift.

   To add a text page: add an entry here, create src/pages/<slug>.astro that
   reads it, and (to link it) add it to the footer. `npm run check:seo` fails if
   a page is in the sitemap but missing from llms.txt.
--------------------------------------------------------------------------- */

export const textPages = [
  {
    slug: "privacy",
    heading: "Privacy policy",
    title: "Privacy policy — cDot",
    description:
      "The privacy policy for cdot.world: what we collect through the contact form and node signup, how the live map works, and your rights.",
    updated: "4 November 2026.",
  },
  {
    slug: "terms",
    heading: "Terms and conditions",
    title: "Terms and conditions — cDot",
    description:
      "The terms and conditions for using cDot: licence, identity verification, third-party dependencies, vulnerability disclosure, governing law and how to contact us.",
    updated: "4 November 2026.",
  },
];

export const textPage = (slug) => {
  const page = textPages.find((p) => p.slug === slug);
  if (!page) throw new Error(`src/data/pages.mjs has no entry for "${slug}".`);
  return page;
};
