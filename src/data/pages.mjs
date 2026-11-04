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
      "The terms and conditions for using cdot.world: use of the site, its information, intellectual property, vulnerability disclosure and governing law.",
    updated: "4 November 2026.",
  },
];

/* ---------------------------------------------------------------------------
   The section pages of the extended site (the ones in the header's Join / Learn /
   Build menus, and Contact in the footer). Each is src/pages/<slug>.astro reading
   its entry here.

   `live: false` is a page that exists but has no content yet: it is served with
   noindex, left out of sitemap.xml and llms.txt, and flagged "Coming soon" nowhere
   else. Set `live: true` when the page has its content and it joins the sitemap
   and llms.txt by itself. `group` is the header menu it sits under.
--------------------------------------------------------------------------- */

export const sectionPages = [
  {
    slug: "nodes",
    group: "Join",
    heading: "Run a node",
    title: "Run a node — cDot",
    description:
      "Run a C-Layer node and help secure the cDot network: what a node does, how to join and what to expect.",
    live: false,
  },
  {
    slug: "community",
    group: "Join",
    heading: "Community",
    title: "Community — cDot",
    description:
      "Join the cDot community: node runners, developers and supporters building the network together.",
    live: false,
  },
  {
    slug: "vision",
    group: "Learn",
    heading: "Vision",
    title: "Vision — cDot",
    description:
      "The vision behind cDot: why the internet needs a missing layer for identity, privacy and payments, and the principles we build on.",
    live: false,
  },
  {
    slug: "architecture",
    group: "Learn",
    heading: "Architecture",
    title: "Architecture — cDot",
    description:
      "How the cDot network is built: the C-Layer, P-Layer and T-Layer, and how the three chains work together.",
    live: false,
  },
  {
    slug: "governance",
    group: "Learn",
    heading: "Governance",
    title: "Governance — cDot",
    description:
      "How the cDot network is governed: how decisions are made and how the community takes part.",
    live: false,
  },
  {
    slug: "roadmap",
    group: "Learn",
    heading: "Roadmap",
    title: "Roadmap — cDot",
    description:
      "The cDot network roadmap: what has launched, what is being built now and what comes next across the C-Layer, P-Layer and T-Layer.",
    live: false,
  },
  {
    slug: "sdk",
    group: "Build",
    heading: "SDK",
    title: "SDK — cDot",
    description:
      "The cDot SDK: build apps on secure identity, communication and payments using the cDot network.",
    live: false,
  },
  {
    slug: "changelog",
    group: "Build",
    heading: "Changelog",
    title: "Changelog — cDot",
    description:
      "What has changed in the cDot network, node software and SDK: release notes and version history for node runners and developers.",
    live: false,
  },
];

/* Team: linked from the footer, not a header menu, so it has no group. */
sectionPages.push({
  slug: "team",
  group: "",
  heading: "Team",
  title: "Team — cDot",
  description:
    "Meet the team behind cDot: the people at Certonymity building the network, the app and the tools around them.",
  live: false,
});

/* Contact: a live page, linked from the footer. */
sectionPages.push({
  slug: "contact",
  group: "",
  heading: "Contact us",
  title: "Contact — cDot",
  description:
    "Contact the cDot team: send us a message about the network, support, press or partnerships, or write to Certonymity Ltd.",
  live: true,
});

export const sectionPage = (slug) => {
  const page = sectionPages.find((p) => p.slug === slug);
  if (!page) throw new Error(`src/data/pages.mjs has no section page "${slug}".`);
  return page;
};

export const textPage = (slug) => {
  const page = textPages.find((p) => p.slug === slug);
  if (!page) throw new Error(`src/data/pages.mjs has no entry for "${slug}".`);
  return page;
};
