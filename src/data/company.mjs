/* ---------------------------------------------------------------------------
   Who we are and how the sites relate - THE ONE PLACE these facts are written.

   The company's legal details and the relationships between its sites were
   hand-copied into the footer, the contact box, the JSON-LD and /llms.txt. Now
   all of them read from here (the same idea as network.mjs for the chains), and
   `npm run check:seo` fails if any rendered copy disagrees with it.

   THE RELATIONSHIPS (keep this accurate - it is what search engines and
   language models are told):

     Certonymity Ltd        the company. certonymity.com is its own site.
       |-- cdot.world       THIS site: the cDot network - concept, mission,
       |                    foundation work, open-source/SDKs, the C-Layer.
       |-- cdot.app         the cDot app: the product built ON the network.
       |                    (Not live yet.)
       |-- docs.cdot.world  documentation for node-runners and developers on
       |                    the network. Its own site, with its own llms.txt.
       `-- c.email          the company's first product, built on the cDot
                            framework. Its own site.

   They are different things made by one company, so none of them is `sameAs`
   another: sameAs says "this IS that entity" and a wrong one can merge
   entities that are not one. They are tied together by the one Organization
   node (same @id on every site) plus `publisher`/`provider` on each, and by
   `relatedLink` between the sites.
--------------------------------------------------------------------------- */

export const company = {
  legalName: "Certonymity Ltd",
  name: "Certonymity",
  number: "16871742",
  jurisdiction: "England and Wales",
  email: "info@certonymity.com",
  linkedin: "https://www.linkedin.com/company/certonymity/",
  address: {
    street: "86-87 Campden Street",
    locality: "London",
    postcode: "W8 7EN",
    country: "GB",
    countryName: "United Kingdom",
  },
};

/* The text shown in the footer. */
export const registrationLine = `Registered company no. ${company.number}, ${company.jurisdiction}.`;

/* One Organization node, one @id, on every site: the company's own. Defined
   here as the same node certonymity.com publishes, so the graphs merge instead
   of describing three look-alike organisations. */
export const ORG_ID = "https://certonymity.com/#organization";

/* The header tagline. The page title, og:title, og:image:alt and the social
   image (brand/og.source.json) all have to match it. */
export const tagline = "Secure identity, communication and payments";

/* The sites around this one. `live: false` marks one that is planned but not
   yet reachable - it is still linked (the relationship is real), but the link
   checker treats it as expected rather than broken. Flip it when it launches. */
export const sites = {
  self: { name: "cDot network", url: "https://cdot.world/", llms: "https://cdot.world/llms.txt", live: true },
  company: {
    name: "Certonymity Ltd",
    url: "https://certonymity.com/",
    llms: "https://certonymity.com/llms.txt",
    live: true,
    role: "the company behind cDot",
  },
  app: {
    name: "cDot app",
    url: "https://cdot.app/",
    llms: "https://cdot.app/llms.txt",
    live: false,
    role: "the product built on the network - features, how-tos and guides",
  },
  docs: {
    name: "cDot Docs",
    url: "https://docs.cdot.world/",
    llms: "https://docs.cdot.world/llms.txt",
    live: true,
    role: "documentation for node-runners and developers on the cDot network",
  },
  cemail: {
    name: "c.Email",
    url: "https://c.email/",
    llms: "https://c.email/llms.txt",
    live: true,
    role: "the company's first product, built on the cDot framework",
  },
};

/* Sibling sites that are products or the company - everything but this site. */
export const relatedSites = [sites.app, sites.company, sites.cemail, sites.docs];

/* "86-87 Campden Street, London W8 7EN, United Kingdom" */
export const addressLine = `${company.address.street}, ${company.address.locality} ${company.address.postcode}, ${company.address.countryName}`;
