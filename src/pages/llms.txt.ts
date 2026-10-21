/* ---------------------------------------------------------------------------
   /llms.txt - the structured summary for language models.

   This used to be a hand-written file in public/. It is a page now because one
   section of it - the three chains, their specifications and which of them are
   live - is a FACT, and the same fact is on the page cards and in the JSON-LD.
   Three hand-kept copies drifted every time the messaging moved, so that section
   is generated from src/data/network.mjs, the one place it is written down.

   Everything else here is prose and stays prose, carried over line for line. It
   mirrors copy that lives in src/pages/index.astro (the hero, the Mission), and
   `npm run check:sync` fails if the two stop agreeing - so when you change the
   page's wording, that check will tell you what to bring across.
--------------------------------------------------------------------------- */

import { chains, llmsEntry, llmsIntro } from "../data/network.mjs";
import { company, sites, addressLine } from "../data/company.mjs";
import { faq, textBlocks } from "../data/faq.mjs";
import { getArticles, formatDate } from "../lib/sanity.js";
import { blogLive } from "../data/blog.mjs";

/* Hard-wraps to the width the rest of the file uses, indenting continuation
   lines to sit under the text of a numbered entry. */
function wrap(text: string, width = 100, indent = "   "): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = indent + word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/* The FAQ, from src/data/faq.mjs: each question as a heading, answers as plain
   text (list items as "- " lines, links as "text (url)"). */
const faqText = faq
  .map((f) =>
    [
      `### ${f.q}`,
      ...textBlocks(f.a).map((b) =>
        typeof b === "string" ? wrap(b, 100, "") : b.list.map((i) => wrap(`- ${i}`, 100, "  ")).join("\n"),
      ),
    ].join("\n\n"),
  )
  .join("\n\n");

/* The Blog, once it is switched on (src/data/blog.mjs): the index and each
   article, newest first. Empty - and the section absent - while it is off. */
const articles = blogLive ? await getArticles() : [];
const blogPages = articles.length
  ? [
      "- [Blog](https://cdot.world/blog/): news, updates and guides from the team building the cDot network.",
      ...articles.map((a) =>
        wrap(`- [${a.title}](https://cdot.world/blog/${a.slug}/)${a.excerpt ? `: ${a.excerpt.replace(/\s+/g, " ")}` : ""}${formatDate(a.date) ? ` (${formatDate(a.date)})` : ""}`, 100, "  "),
      ),
    ].join("\n")
  : "";

/* Said only while the app site is not live; flip `live` in company.mjs at launch. */
const notYet = sites.app.live ? "" : " Not yet released.";

const network = [
  wrap(llmsIntro(), 100, ""),
  "",
  ...chains.map((c, i) => wrap(llmsEntry(c, i))),
].join("\n");

/* The relationship and company sections. Built here, not written inline, so they
   follow src/data/company.mjs and wrap like the rest of the file. */
const bullet = (text: string) => wrap(`- ${text}`, 100, "  ");
const relationships = [
  "## How the cDot sites and Certonymity relate",
  "",
  bullet(`Certonymity Ltd (${sites.company.url}) is the company that builds cDot and c.Email.`),
  bullet("This site, cdot.world, is the cDot network itself: the concept, the mission, the C-Layer and the open-source work and SDKs behind it."),
  bullet(`cDot app (${sites.app.url}) is ${sites.app.role}.${notYet}`),
  bullet(`c.Email (${sites.cemail.url}) is ${sites.cemail.role}.`),
  bullet(`cDot Docs (${sites.docs.url}) is ${sites.docs.role}.`),
  "",
  "## Related",
  "",
  bullet(`[cDot app](${sites.app.url}): ${sites.app.role}.${notYet} Its own llms.txt: ${sites.app.llms}`),
  bullet(`[Certonymity Ltd](${sites.company.url}): ${sites.company.role}. Its own llms.txt: ${sites.company.llms}`),
  bullet(`[c.Email](${sites.cemail.url}): ${sites.cemail.role}. Its own llms.txt: ${sites.cemail.llms}`),
  bullet(`[cDot Docs](${sites.docs.url}): ${sites.docs.role}. Its own llms.txt: ${sites.docs.llms}`),
  bullet(`[Certonymity on LinkedIn](${company.linkedin}): company profile.`),
  "",
  "## Company",
  "",
  bullet(`${company.legalName}, registered in ${company.jurisdiction}, company number ${company.number}.`),
  bullet(`Registered office: ${addressLine}.`),
].join("\n");

const body = `# cDot

> cDot is the network for verified identity, encrypted communication, instant payments, and
> programmable money - the operating system for a secure, private internet. Built by Certonymity
> Ltd (London, UK).

cDot is built on the C-Layer, a blockchain for secure, decentralised identity run by independent
nodes worldwide. Coming soon is the full family of three purpose-built blockchains, each engineered
for what it does best: decentralised identity, stablecoin settlement, and trading, operating as one
trusted network.

Mission: cDot is secure, scalable, and community-driven. It is the blockchain network built
for encrypted, trusted, and instant interactions between verified parties - whether in the form of
email, messaging, payments or trades. Get the cDot app to use encrypted email and chat, generate
privacy-preserving identity proofs, and make private payments. With SDKs and open-source code
available soon for anyone to build with, our vision is for a community-driven ecosystem of
innovative, privacy-protecting apps using our building blocks of secure identity, communication and
payments. A new internet, built on cDot.

The problem: cDot is where value is exchanged between people, businesses, and machines. Stablecoins
enable instant, borderless, programmable transactions - but today's blockchains aren't designed for
them. Existing systems are either fully general or optimised for trading, and none were built to
integrate identity with payments. Transactions at scale don't just need speed and low cost. They
need verifiable identity on both sides, including a system for identity that can account for the AI
agents increasingly transacting on behalf of people and businesses. With decentralised identity,
stablecoin payments, and agent permissions, cDot exists to close the gap. cDot is built by the team
behind c.Email (https://c.email/).

${network}

Use cases - encrypted email and chat, anonymous age verification, verifiable credentials,
global payments, embedded finance, microtransactions, agentic payments, asset recovery (never lose
your self custodied crypto). Secure design and invisible cryptography means every transaction
settles instantly, every participant (human or agent) is verified and accountable, while every
real-world identity and transaction stays private.

## FAQ

${faqText}

## Pages

- [cDot](https://cdot.world/): ${blogLive ? "the landing page" : "the single landing page"} - mission, the problem, the three
  chains and their specifications, use cases, and contact.${blogPages ? "\n" + blogPages : ""}

${relationships}

## Data

- [C-Layer node registry](https://map.c-layer.certonym.org/api/data): live JSON of the
  community-run nodes plotted on the site's network map.

## Contact

- [${company.email}](mailto:${company.email}): general enquiries.
`;

export function GET() {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
