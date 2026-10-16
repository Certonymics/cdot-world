/* ---------------------------------------------------------------------------
   The three chains - THE ONE PLACE their facts are written down.

   Four things used to state these by hand and drift apart silently:
     - the cards on the page            (src/pages/index.astro)
     - the structured data              (src/layouts/Layout.astro, JSON-LD)
     - the machine-readable summary     (public/llms.txt, now src/pages/llms.txt.ts)
     - the launch status in each of them
   They now all read from here, so changing a throughput figure, a description or
   a launch status is one edit. It changed three times in one afternoon before this
   existed, and each time one copy was missed.

   WHAT IS NOT HERE: free-text marketing copy (the hero, the Mission paragraphs).
   That is written in the page and checked against the other surfaces by
   `npm run check:sync`, because it is prose, not a fact.

   A plain .mjs file on purpose: no build step of its own, importable from Astro
   components, the llms.txt endpoint, and the sync check script alike.
--------------------------------------------------------------------------- */

export const STATUS = { live: "Live", soon: "Launching soon" };

const tps = (n) => `${n.toLocaleString("en-GB")} tx/s`;

/* Named once, so a card's chip and its structured-data value cannot disagree. */
const C_TPS = 15000;
const PT_TPS = 30000;

/* Each chain:
     status    "live" | "soon". Drives the "Launching soon" chip on the card, the
               Status property in the JSON-LD, and the wording in llms.txt.
     summary   The card paragraph. The JSON-LD and llms.txt reuse it.
     facts     The specifications, in the order they are shown. Each is
               { name, value, unitText?, chip? }:
                 name/value/unitText  become a schema.org PropertyValue. `value`
                                      stays a number where it is one, so the
                                      figure is machine-comparable.
                 chip                 the text shown on the card. A fact with NO
                                      chip is shown inside another fact's chip
                                      (e.g. "Highly parallel" rides along in the
                                      throughput chip), but is still emitted to
                                      the structured data in its own right. */
export const chains = [
  {
    id: "c-layer",
    name: "C-Layer",
    alternateName: "cDot identity and asset recovery chain",
    title: "Identity and asset recovery chain",
    purpose: "decentralised identity",
    category: "SecurityApplication",
    status: "live",
    summary:
      "A decentralised identity chain for people, businesses, and agents. Cryptographic pseudonyms of verified real identities provide privacy with accountability. Run by nodes around the world for maximum resilience and decentralisation.",
    facts: [
      { name: "Throughput", value: C_TPS, unitText: "tx/s", chip: `${tps(C_TPS)}, highly parallel` },
      { name: "Architecture", value: "Highly parallel" },
      { name: "Smart contracts", value: "WASM", chip: "WASM smart contracts" },
      { name: "Finality", value: 20, unitText: "s", chip: "20s finality" },
      { name: "Access", value: "Permissionless", chip: "Permissionless" },
      { name: "Visibility", value: "Public and pseudonymous", chip: "Public and pseudonymous" },
    ],
  },
  {
    id: "p-layer",
    name: "P-Layer",
    alternateName: "cDot settlement chain",
    title: "Settlement chain",
    purpose: "stablecoin settlement",
    category: "FinanceApplication",
    status: "soon",
    summary:
      "Engineered for high-throughput, low-cost global stablecoin settlement and truly programmable money, with native on- and off-ramping. Agentic transactions supported with verifiable, revocable permissions.",
    facts: [
      { name: "Throughput", value: PT_TPS, unitText: "tx/s", chip: tps(PT_TPS) },
      { name: "Finality", value: "<1", unitText: "s", chip: "Finality <1s" },
      { name: "Byzantine security", value: "45%", chip: "Byzantine security 45%" },
    ],
  },
  {
    id: "t-layer",
    name: "T-Layer",
    alternateName: "cDot trading chain",
    title: "Trading chain",
    purpose: "trading",
    category: "FinanceApplication",
    status: "soon",
    summary:
      "A high-performance decentralised exchange, offering stablecoin swaps and perpetual futures in a predictable execution environment.",
    facts: [
      { name: "Throughput", value: PT_TPS, unitText: "tx/s", chip: `${tps(PT_TPS)}, native multithreading` },
      { name: "Architecture", value: "Native multithreading" },
      { name: "Finality", value: "<1", unitText: "s", chip: "Finality <1s" },
      { name: "Nodes", value: "Node-permissioned overlay on C-Layer", chip: "Node-permissioned overlay on C-Layer" },
      { name: "Visibility", value: "Private and accountable", chip: "Private and accountable" },
      { name: "Matching engine", value: "Native NASDAQ-like", chip: "Native NASDAQ-like matching engine" },
    ],
  },
];

/* --- helpers every consumer shares ---------------------------------------- */

/* "A, B and C" - no Oxford comma, matching the rest of the site's copy. */
export const joinList = (items) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const NUMBER_WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" };

/* "three" - the count as the copy writes it, so "one network, three specialised
   chains" and llms.txt's intro stay right when a chain is added. */
export const chainCountWord = () => NUMBER_WORDS[chains.length] ?? String(chains.length);

export const liveChains = () => chains.filter((c) => c.status === "live");
export const soonChains = () => chains.filter((c) => c.status === "soon");

/* The text of each chip on a chain's card, in order. */
export const chipsOf = (chain) => chain.facts.filter((f) => f.chip).map((f) => f.chip);

/* The schema.org description. A chain that has not launched says so up front,
   because an answer engine will otherwise quote its figures as if it were live. */
export const ldDescription = (chain) =>
  chain.status === "soon" ? `${STATUS.soon}. ${chain.summary}` : chain.summary;

/* Status first, then every fact, as schema.org PropertyValues. */
export const ldProperties = (chain) => [
  { "@type": "PropertyValue", name: "Status", value: STATUS[chain.status] },
  ...chain.facts.map((f) =>
    f.unitText
      ? { "@type": "PropertyValue", name: f.name, value: f.value, unitText: f.unitText }
      : { "@type": "PropertyValue", name: f.name, value: f.value },
  ),
];

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/* One chain as a numbered entry for llms.txt (before wrapping). */
export const llmsEntry = (chain, index) =>
  `${index + 1}. ${chain.name} (${chain.status === "live" ? "live" : "launching soon"}) - ` +
  `${lowerFirst(chain.title)}: ${lowerFirst(chain.summary)} Specifications: ${chipsOf(chain).join("; ")}.`;

/* "The network (...). The C-Layer is live; the P-Layer and T-Layer are launching soon:" */
export const llmsIntro = () => {
  const live = liveChains().map((c) => c.name);
  const soon = soonChains().map((c) => c.name);
  const be = (list) => (list.length > 1 ? "are" : "is");
  return (
    `The network (${chainCountWord()} chains, interoperable by design). ` +
    `The ${joinList(live)} ${be(live)} live; the ${joinList(soon)} ${be(soon)} launching soon:`
  );
};
