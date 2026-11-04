/* ---------------------------------------------------------------------------
   The header menus - THE ONE PLACE they are written. Header.astro renders this.

   An item with an `href` is a link (`external` opens a new tab); one without is
   shown as "Coming soon". Pages are named by slug and read their label and URL
   from src/data/pages.mjs. The Whitepaper has no page yet, so it is a "Coming soon"
   label; give it an href when it exists. "Get the app" and "Code" are labels too, until the app is live
   and the code is public. (The Blog is in the footer, not here.)
--------------------------------------------------------------------------- */

import { sectionPage } from "./pages.mjs";
import { sites } from "./company.mjs";

const page = (slug) => {
  const p = sectionPage(slug);
  return { label: p.heading, href: `/${p.slug}/` };
};

export const navGroups = [
  {
    label: "Join",
    items: [
      /* A "Coming soon" label until the app is live; it becomes a link by itself when
         `sites.app.live` is flipped in src/data/company.mjs. */
      { label: "Get the app", href: sites.app.live ? sites.app.url : undefined, external: true },
      page("nodes"),
      page("community"),
    ],
  },
  {
    label: "Learn",
    items: [
      page("vision"),
      page("architecture"),
      page("governance"),
      { label: "Whitepaper", href: undefined },
      page("press"),
    ],
  },
  {
    label: "Build",
    items: [
      page("sdk"),
      { label: "Docs", href: sites.docs.url, external: true },
      { label: "Code", href: undefined },
    ],
  },
];
