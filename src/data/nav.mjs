/* ---------------------------------------------------------------------------
   The header menus - THE ONE PLACE they are written. Header.astro renders this.

   An item with an `href` is a link (`external` opens a new tab); one without is
   shown as "Coming soon". Pages are named by slug and read their label and URL
   from src/data/pages.mjs. The Whitepaper has no page yet, so it is a "Coming soon"
   label; give it an href when it exists. "Code" is a label too, until it is live
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
      page("nodes"),
      { label: "Explorer", href: "http://54.37.17.29/", external: true },
      { label: "Community", href: "https://discord.gg/yBP95phmb", external: true },
    ],
  },
  {
    label: "Learn",
    items: [
      page("vision"),
      page("architecture"),
      page("governance"),
      { label: "Whitepaper", href: undefined },
      page("roadmap"),
    ],
  },
  {
    label: "Build",
    items: [
      { label: "SDK", href: undefined },
      { label: "Docs", href: sites.docs.url, external: true },
      { label: "Code", href: undefined },
      { label: "Changelog", href: undefined },
    ],
  },
];
