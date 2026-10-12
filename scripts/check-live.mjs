/* ---------------------------------------------------------------------------
   `npm run check:live` - does the LIVE web agree with what we publish?

   check:seo reads the build. This asks the internet, because some things can
   only break out there: a link that stops resolving, a deploy that did not go
   out, a sibling site that changed how it describes ours. It runs weekly in
   GitHub Actions (.github/workflows/live-check.yml) and by hand.

   Two grades, because not everything is ours to fix:
     FAIL  our own problem - the live site is down or stale, or a link we publish
           is dead. Exits non-zero.
     WARN  a sibling site (certonymity.com, c.email, cdot.app) disagrees with the
           relationship we state. Reported, never fails: tell whoever owns it.
   A site marked `live: false` in src/data/company.mjs (the app, until launch) is
   expected to be unreachable and is reported as pending, not failed.
--------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sites, relatedSites, ORG_ID, company } from "../src/data/company.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fails = [], warns = [], pending = [];
let ok = 0;
const UA = { "user-agent": "cdot-world-link-check (+https://cdot.world/)" };

async function get(url, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    return await fetch(url, { redirect: "follow", headers: UA, signal: ctl.signal, ...init });
  } catch (e) {
    return { ok: false, status: 0, error: e.cause?.code || e.message, text: async () => "" };
  } finally {
    clearTimeout(t);
  }
}

/* 1. our own live site serves what we expect. */
for (const path of ["/", "/robots.txt", "/llms.txt", "/sitemap.xml"]) {
  const r = await get(new URL(path, sites.self.url).href);
  if (r.ok) ok++; else fails.push(`${new URL(path, sites.self.url).href} returned ${r.status || r.error}.`);
}
{
  const html = await (await get(sites.self.url)).text();
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try {
    const org = JSON.parse(ld[1])["@graph"].find((n) => n["@type"] === "Organization");
    org?.["@id"] === ORG_ID ? ok++ : fails.push(`the live JSON-LD Organization @id is "${org?.["@id"]}", not ${ORG_ID}. Is the latest build deployed?`);
  } catch {
    fails.push("the live page has no parseable JSON-LD.");
  }
  /^\s*$/.test(html) || (html.includes("[email&#160;protected]") ? fails.push('the live page shows "[email protected]": Cloudflare is obfuscating an address outside <!--email_off-->.') : ok++);
}

/* 2. every external link we publish still resolves. */
const urls = new Set();
for (const f of ["dist/index.html", "dist/llms.txt"]) {
  const text = readFileSync(resolve(root, f), "utf8");
  for (const m of text.matchAll(/https:\/\/[^\s"'<>)\]]+/g)) urls.add(m[0].replace(/[.,;]+$/, ""));
}
/* script.google.com: the two form endpoints. They take POSTs, a bare request tells
   us nothing, and a script has no business poking a form backend. */
const SKIP = [/^https:\/\/cdot\.world/, /script\.google(usercontent)?\.com/, /schema\.org/, /w3\.org/, /sitemaps\.org/, /fonts\.(googleapis|gstatic)/];
const notLive = relatedSites.filter((s) => !s.live).map((s) => new URL(s.url).host);
await Promise.all(
  [...urls].filter((u) => !SKIP.some((re) => re.test(u))).map(async (u) => {
    let r = await get(u, { method: "HEAD" });
    if (!r.ok) r = await get(u);
    if (r.ok) return void ok++;
    if (notLive.includes(new URL(u).host)) return void pending.push(`${u} (${r.status || r.error}) - site not live yet`);
    /* LinkedIn answers automated requests with 999 whatever the page; it is not a dead link. */
    if (/linkedin\.com/.test(u) && r.status) return void warns.push(`${u} answered ${r.status} to a script (normal for LinkedIn); check it in a browser occasionally.`);
    fails.push(`${u} returned ${r.status || r.error}.`);
  }),
);

/* 3. the company site tells the same story. Not ours to edit: WARN only. */
if (sites.company.live) {
  const llms = await (await get(sites.company.llms)).text();
  llms.includes(sites.self.url) ? ok++ : warns.push(`${sites.company.llms} does not mention ${sites.self.url}.`);
  llms.includes(sites.self.llms) ? ok++ : warns.push(`${sites.company.llms} does not link to our llms.txt (${sites.self.llms}).`);
  llms.includes(company.number) ? ok++ : warns.push(`${sites.company.llms} does not carry company number ${company.number}.`);
  const home = await (await get(sites.company.url)).text();
  try {
    const g = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
    const org = g.find((n) => n["@type"] === "Organization");
    org?.["@id"] === ORG_ID ? ok++ : warns.push(`certonymity.com's Organization @id is "${org?.["@id"]}", expected ${ORG_ID}.`);
    const defined = new Set(g.map((n) => n["@id"]));
    /* A sameAs to one of OUR @ids that no longer exists is a claim about nothing. */
    for (const s of org?.sameAs || [])
      if (s.startsWith(sites.self.url) && s !== sites.self.url)
        warns.push(`certonymity.com says its Organization is sameAs ${s}. That node is not in our graph (the Organization is now ${ORG_ID}) - the line can be removed, since both sites use the same @id.`);
    for (const n of g.filter((n) => n.url === sites.self.url && n["@type"] === "SoftwareApplication"))
      (n.sameAs || []).includes(`${sites.self.url}#cdot`) ? ok++ : warns.push(`certonymity.com's "${n.name}" node points at ${sites.self.url} but is not sameAs ${sites.self.url}#cdot.`);
  } catch {
    warns.push("certonymity.com has no parseable JSON-LD.");
  }
}

/* --- report ---------------------------------------------------------------- */
const list = (title, a) => a.length && console.log(`\n${title}\n${a.map((x) => `  - ${x}`).join("\n")}`);
list("FAIL (ours to fix)", fails);
list("WARN (another site's to fix)", warns);
list("PENDING (expected until that site launches)", pending);
console.log(`\ncheck-live: ${ok} ok, ${fails.length} failed, ${warns.length} warnings, ${pending.length} pending.`);
process.exit(fails.length ? 1 : 0);
