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

const network = [
  wrap(llmsIntro(), 100, ""),
  "",
  ...chains.map((c, i) => wrap(llmsEntry(c, i))),
].join("\n");

const body = `# cDot

> cDot is the network for verified identity, encrypted communication, instant payments, and
> programmable money - the operating system for a secure, private internet. Built by Certonymity
> Ltd (London, UK).

cDot is built on the C-Layer, a blockchain for secure, decentralised identity run by independent
nodes worldwide. Coming soon is the full family of three purpose-built blockchains, each engineered
for what it does best: decentralised identity, stablecoin settlement, and trading, operating as one
trusted network.

Mission: cDot is secure, private, scalable, and community-driven. It is the blockchain network built
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

## Pages

- [cDot](https://cdot.world/): the single landing page - mission, the problem, the three
  chains and their specifications, use cases, and contact.

## Related

- [cDot app](https://cdot.app/): the product built on the network - features, how-tos and guides.
  This site (cdot.world) covers the network itself: the concept, the mission, and the open-source
  work and SDKs behind it.
- [Certonymity on LinkedIn](https://www.linkedin.com/company/certonymity/): company profile.
- [Certonymity Ltd](https://certonymity.com/): the company behind cDot.

## Data

- [C-Layer node registry](https://map.c-layer.certonym.org/api/data): live JSON of the
  community-run nodes plotted on the site's network map.

## Contact

- [info@certonymity.com](mailto:info@certonymity.com): general enquiries.
- Certonymity Ltd, 86-87 Campden Street, London W8 7EN, United Kingdom.
`;

export function GET() {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
