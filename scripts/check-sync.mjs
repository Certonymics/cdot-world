/* ---------------------------------------------------------------------------
   `npm run check:sync` - do the places that state our messaging still agree?

   Run AFTER a build: it reads dist/, because that is what visitors, search
   engines and language models actually receive.

   WHY THIS EXISTS
   The same messaging is stated in several places: the hero and the Mission copy on
   the page, the title and meta tags, the JSON-LD, and /llms.txt. Each time the
   wording moved, one of them was missed - the tagline in llms.txt, a stale JSON-LD
   description, a launch status that still read as live. Facts about the chains are
   now generated from one file (src/data/network.mjs) and cannot drift. This script
   covers the part that cannot be generated: prose someone wrote by hand.

   WHAT IT CHECKS
     1. The header tagline matches the page title, og:title and og:image:alt.
     2. The hero's first sentence appears in the meta description, og:description,
        the JSON-LD description and llms.txt.
     3. The H1 appears in llms.txt.
     4. Mission copy: every sentence on the page has a near-match in llms.txt, and
        every sentence in llms.txt's Mission / The problem has one on the page - so a
        sentence deleted from the page cannot linger in llms.txt.
     5. The use-case pills appear in llms.txt's "Use cases" line.
     6. The chains: launch status agrees across the card, the JSON-LD and llms.txt;
        every chip is in llms.txt; the "three chains" wording matches the data; and
        "coming soon" wording exists exactly while a chain is not live.

   It reports every disagreement, not just the first, and says what to bring across.
   Exits non-zero on any, so CI can gate on it. It cannot tell you the copy is GOOD,
   only that it is consistent.
--------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chains, STATUS, chipsOf, soonChains, chainCountWord } from "../src/data/network.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => readFileSync(resolve(root, p), "utf8");

let page, llms;
try {
  page = read("dist/index.html");
  llms = read("dist/llms.txt");
} catch {
  console.error("check-sync: dist/ is missing or incomplete. Run `npm run build` first.");
  process.exit(1);
}

/* --- parsing: just enough HTML to read our own output ----------------------- */

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const one = (re, src = page) => {
  const m = src.match(re);
  return m ? decode(m[1]).replace(/\s+/g, " ").trim() : "";
};
const meta = (attr, value) =>
  one(new RegExp(`<meta ${attr}="${value}" content="([^"]*)"`));

/* Normalise for comparison: case, dashes, quotes and punctuation all vary between
   the page and llms.txt on purpose (em dash vs hyphen, curly vs straight), and none
   of that is drift. What is left is the words. */
const words = (s) =>
  s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const tokens = (s) => new Set(words(s).split(" ").filter(Boolean));
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
};
const contains = (haystack, needle) => ` ${words(haystack)} `.includes(` ${words(needle)} `);
const sentences = (text) =>
  text.trim().split(/(?<=[.!?])\s+(?=[A-Za-z(])/).map((s) => s.trim()).filter(Boolean);

const paragraphs = llms.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim());
const llmsPara = (prefix) => paragraphs.find((p) => p.startsWith(prefix)) || "";
/* The numbered chain entries sit on consecutive lines with no blank line between
   them, so they are one "paragraph" to the splitter above; read them separately. */
const llmsEntries = [...llms.matchAll(/^\d\. .*(?:\n(?!\d\. |\n).*)*/gm)].map((m) =>
  m[0].replace(/\s*\n\s*/g, " ").trim(),
);
const llmsQuote = paragraphs
  .filter((p) => p.startsWith(">"))
  .join(" ")
  .replace(/>\s?/g, "")
  .trim();

/* --- what the page says ------------------------------------------------------ */

const tagline = one(/<span class="tag">(.*?)<\/span>/s);
const title = one(/<title>(.*?)<\/title>/s);
const h1 = one(/<h1[^>]*>(.*?)<\/h1>/s);
const heroSub = one(/<p class="sub">(.*?)<\/p>/s);
const heroFirstSentence = sentences(heroSub)[0] || "";
const metaDescription = meta("name", "description");
const ogTitle = meta("property", "og:title");
const ogDescription = meta("property", "og:description");
const ogAlt = meta("property", "og:image:alt");

const ldGraph = JSON.parse(
  page.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
)["@graph"];
const ldById = (id) => ldGraph.find((n) => n["@id"] === `https://cdot.world/#${id}`);

const mission = page.slice(page.indexOf('<section id="mission">'), page.indexOf("</section>", page.indexOf('<section id="mission">')));
const missionH2s = [...mission.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map((m) => decode(m[1]).trim());
const missionLeads = [...mission.matchAll(/<p class="lead">(.*?)<\/p>/gs)].map((m) => decode(m[1]).replace(/\s+/g, " ").trim());
const pills = [...mission.matchAll(/<span class="use"[^>]*>(.*?)<\/span>/gs)].map((m) => decode(m[1]).trim());
const pageText = decode(page);

/* --- the checks --------------------------------------------------------------- */

const failures = [];
let passed = 0;
const check = (rule, ok, detail) => {
  if (ok) { passed += 1; return; }
  failures.push({ rule, detail });
};

/* 1. Tagline */
check("1. Tagline",
  title === `cDot: ${tagline}`,
  `the header tagline is "${tagline}" but the page <title> is "${title}".\n      Fix: make the title "cDot: ${tagline}" (index.astro), or change the tagline (Header.astro).`);
check("1. Tagline",
  ogTitle === `cDot — ${tagline}`,
  `og:title is "${ogTitle}", expected "cDot — ${tagline}".\n      Fix: update ogTitle in index.astro.`);
check("1. Tagline",
  words(ogAlt) === words(`cDot ${tagline}`),
  `og:image:alt is "${ogAlt}", which does not match the tagline "${tagline}".\n      Fix: update the og:image:alt in Layout.astro.`);

/* 2. Hero sentence */
const heroTargets = [
  ["meta description", metaDescription],
  ["og:description", ogDescription],
  ["the JSON-LD cDot description", ldById("cdot")?.description || ""],
  ["llms.txt's opening summary", llmsQuote],
];
for (const [label, text] of heroTargets) {
  check("2. Hero sentence", contains(text, heroFirstSentence),
    `the hero says "${heroFirstSentence}" but ${label} does not contain it.\n      Fix: bring ${label} in line with the hero.`);
}

/* 3. H1 */
check("3. H1", contains(llmsQuote, h1),
  `the H1 is "${h1}" but llms.txt's opening summary does not contain it.\n      Fix: update the first paragraph of src/pages/llms.txt.ts.`);

/* 4. Mission copy <-> llms.txt */
const FORWARD = 0.9;   // a page sentence must be near-verbatim in llms.txt: catches a single changed word
const REVERSE = 0.7;   // an llms.txt sentence must still be recognisable on the page: catches leftovers
/* Sentences that exist ONLY in llms.txt, on purpose. Add here, with a reason. */
const LLMS_ONLY = [
  "cDot is built by the team behind c.Email (https://c.email/).", // provenance for machines; not page copy
];
const llmsSentences = ["Mission:", "The problem:"]
  .map((label) => llmsPara(label).replace(label, ""))
  .flatMap(sentences)
  .filter((s) => !LLMS_ONLY.includes(s));
const pageSentences = missionLeads.flatMap(sentences);
const pageAll = [...pageSentences, ...missionH2s];

for (const s of pageSentences) {
  const best = Math.max(...llmsSentences.map((l) => jaccard(s, l)));
  check("4. Mission copy", best >= FORWARD,
    `on the page but not (or only loosely) in llms.txt:\n        "${s}"\n      Fix: bring this sentence into the Mission / The problem paragraphs in src/pages/llms.txt.ts.`);
}
for (const l of llmsSentences) {
  const best = Math.max(...pageAll.map((s) => jaccard(l, s)));
  check("4. Mission copy", best >= REVERSE,
    `in llms.txt but no longer on the page:\n        "${l}"\n      Fix: remove it from src/pages/llms.txt.ts, or put it back on the page.`);
}

/* 5. Use-case pills */
const llmsUseCases = llmsPara("Use cases");
for (const p of pills) {
  check("5. Use cases", contains(llmsUseCases, p),
    `the page has the use case "${p}" but llms.txt's "Use cases" line does not.\n      Fix: update the "Use cases" paragraph in src/pages/llms.txt.ts.`);
}

/* 6. The chains */
const cardFor = (name) => {
  const m = page.match(new RegExp(`<div class="chain">(?:(?!<div class="chain">).)*?<span class="chain-id">${name}</span>.*?<div class="specs">.*?</div></div>`, "s"));
  return m ? m[0] : "";
};
for (const c of chains) {
  const card = cardFor(c.name);
  const soon = c.status === "soon";
  check("6. Chains", Boolean(card), `no card for ${c.name} on the page.\n      Fix: it should render from src/data/network.mjs - was index.astro changed?`);
  check("6. Chains", card.includes("chain-soon") === soon,
    `${c.name} is "${c.status}" in the data but its card ${card.includes("chain-soon") ? "shows" : "does not show"} a "Launching soon" label.`);
  const ldStatus = ldById(c.id)?.additionalProperty?.find((p) => p.name === "Status")?.value;
  check("6. Chains", ldStatus === STATUS[c.status],
    `${c.name}'s JSON-LD Status is "${ldStatus}", expected "${STATUS[c.status]}".`);
  const llmsLine = llmsEntries.find((e) => new RegExp(`^\\d\\. ${c.name} \\(`).test(e)) || "";
  const llmsWord = soon ? "launching soon" : "live";
  check("6. Chains", llmsLine.includes(`(${llmsWord})`),
    `${c.name} should read "(${llmsWord})" in llms.txt; found: "${llmsLine.slice(0, 40)}".`);
  for (const chip of chipsOf(c)) {
    check("6. Chains", contains(llmsLine, chip),
      `${c.name}'s spec "${chip}" is missing from its llms.txt entry.`);
  }
}
const countWord = chainCountWord();
const networkH2 = [...page.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map((m) => decode(m[1])).find((t) => /chains/i.test(t)) || "";
check("6. Chains", !countWord || contains(networkH2, countWord),
  `there are ${chains.length} chains in the data but the heading says "${networkH2}".\n      Fix: update the heading in index.astro.`);
check("6. Chains", !countWord || contains(llmsPara("The network"), countWord),
  `there are ${chains.length} chains in the data but llms.txt's network intro does not say "${countWord}".`);
const anySoon = soonChains().length > 0;
const mentionsSoon = /coming soon|launching soon/i.test(pageText);
check("6. Chains", anySoon === mentionsSoon,
  anySoon
    ? `a chain is not live yet but the page says nothing about it launching soon.`
    : `every chain is live but the page still says "coming soon" / "launching soon".\n      Fix: remove it from index.astro (the standfirst above the cards) - and the chips will already be gone.`);

/* --- report --------------------------------------------------------------------- */

if (failures.length) {
  console.error(`\ncheck-sync: ${failures.length} disagreement${failures.length === 1 ? "" : "s"} between the places our messaging lives.\n`);
  let last = "";
  for (const f of failures) {
    if (f.rule !== last) { console.error(`  ${f.rule}`); last = f.rule; }
    console.error(`    - ${f.detail}`);
  }
  console.error(`\n(${passed} other check${passed === 1 ? "" : "s"} passed.)`);
  process.exit(1);
}
console.log(`check-sync: all ${passed} checks passed - the page, meta tags, JSON-LD and llms.txt agree.`);
