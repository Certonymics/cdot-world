/* ---------------------------------------------------------------------------
   `npm run check:seo` - are the SEO, GEO and structural pieces correct and
   consistent with the site's own content and with src/data/*.mjs?

   Run AFTER a build: it reads dist/, because that is what crawlers and language
   models actually receive. check:sync covers the MESSAGING (hero, Mission, the
   chains); this covers everything around it.

   WHAT IT CHECKS
     1. robots.txt   - points at the sitemap; no crawler is blocked (training bots
                       included, by policy).
     2. sitemap.xml  - lists every indexable page and nothing noindex; lastmod
                       valid and equal to the page's dateModified.
     3. Every page   - title/description lengths, canonical, og:* and twitter tags,
                       the social image exists at 1200x630, lang, one <h1>, no
                       skipped heading levels, in-page links resolve, no duplicate
                       ids, external links are rel=noopener. noindex pages carry
                       no canonical.
     4. JSON-LD      - parses; ids are unique; every reference resolves; ONE
                       Organization with the company's @id (shared with
                       certonymity.com), its real url and Companies House number;
                       sameAs holds no sibling site (identity only); relatedLink
                       points at the app; dates are sane.
     5. Company data - the footer, contact box and llms.txt all carry the facts in
                       src/data/company.mjs; no stray email address; every email is
                       shielded from Cloudflare's obfuscation (crawlers would
                       otherwise read "[email protected]").
     6. Relationships - llms.txt names every sibling site and its llms.txt.
     8. FAQ          - the accordion, the FAQPage JSON-LD and llms.txt carry the
                       same questions, in the same order, with real answers.
     9. Blog         - absent while switched off (no pages, no links, no sitemap or
                       llms.txt entries, footer shows "Coming soon"); complete while
                       on (index and articles built, listed, Article JSON-LD valid).
     7. Social image - brand/og.source.json says it was made from the CURRENT
                       tagline (otherwise: run `npm run og`).

   It reports every failure, not just the first. Exits non-zero on any. It cannot
   tell you the copy is good; only that it is correct and consistent.
--------------------------------------------------------------------------- */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blogLive, sanity } from "../src/data/blog.mjs";
import { company, sites, ORG_ID, tagline, registrationLine, addressLine, relatedSites } from "../src/data/company.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const SITE = "https://cdot.world";

if (!existsSync(dist)) {
  console.error("check-seo: dist/ is missing. Run `npm run build` first.");
  process.exit(1);
}

const failures = [];
let passed = 0;
const check = (rule, ok, detail) => (ok ? (passed += 1) : failures.push({ rule, detail }));
const read = (p) => readFileSync(resolve(dist, p), "utf8");

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/* Every built page: dist/index.html -> "/", dist/foo/index.html -> "/foo/", and
   dist/404.html -> "/404/". */
const pages = walk(dist)
  .filter((f) => f.endsWith(".html"))
  .map((f) => {
    const rel = relative(dist, f).replace(/\\/g, "/");
    const path = rel === "index.html" ? "/" : "/" + rel.replace(/(\/index)?\.html$/, "/");
    return { path, html: readFileSync(f, "utf8") };
  });

/* Pixel size of a PNG or JPEG, read from the file's own header. */
function imageSize(b) {
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9; ) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return { w: 0, h: 0 };
}
const attr = (html, re) => (html.match(re) || [])[1] || "";
const meta = (html, kind, name) =>
  attr(html, new RegExp(`<meta ${kind}="${name}" content="([^"]*)"`));
const isNoindex = (html) => /<meta name="robots" content="[^"]*noindex/.test(html);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const isoOk = (d) => !Number.isNaN(Date.parse(d)) && /^\d{4}-\d\d-\d\dT/.test(d);

const indexable = pages.filter((p) => !isNoindex(p.html));
const home = pages.find((p) => p.path === "/");

/* --- 1. robots.txt -------------------------------------------------------- */
{
  const r = read("robots.txt");
  const groups = {};
  let uas = [];
  let lastWasUa = false;
  for (const raw of r.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [k, ...v] = line.split(":");
    const key = k.trim().toLowerCase(), val = v.join(":").trim();
    if (key === "user-agent") {
      if (!lastWasUa) uas = [];
      uas.push(val);
      uas.forEach((u) => (groups[u] ||= []));
      lastWasUa = true;
    } else {
      lastWasUa = false;
      if (key === "allow" || key === "disallow") uas.forEach((u) => groups[u].push([key, val]));
    }
  }
  const blocksAll = (ua) => (groups[ua] || []).some(([k, v]) => k === "disallow" && v === "/");
  const sm = [...r.matchAll(/^Sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  check("1. robots.txt", sm.includes(`${SITE}/sitemap.xml`),
    `no "Sitemap: ${SITE}/sitemap.xml" line (found: ${sm.join(", ") || "none"}).`);
  check("1. robots.txt", !!groups["*"] && !blocksAll("*"),
    `"User-agent: *" must exist and must not Disallow: / - that would hide the site from search engines.`);
  /* Policy: everyone is allowed, training crawlers included. The named AI
     crawlers are listed so that someone adding a block for one of them gets told. */
  for (const ua of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot",
                    "GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "Applebot-Extended", "Meta-ExternalAgent", "Bytespider"])
    check("1. robots.txt", !blocksAll(ua),
      `robots.txt blocks ${ua}. The policy is that every crawler is allowed, training crawlers included; if that has changed, change it in scripts/check-seo.mjs, README.md and the sibling sites together.`);
  check("1. robots.txt", /\/llms\.txt/.test(r), "robots.txt no longer mentions /llms.txt.");
}

/* --- 2. sitemap.xml ------------------------------------------------------- */
{
  const x = read("sitemap.xml");
  const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const mods = [...x.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  for (const p of indexable)
    check("2. sitemap.xml", locs.includes(SITE + p.path),
      `${SITE + p.path} is an indexable page but is not in sitemap.xml.`);
  for (const p of pages.filter((p) => isNoindex(p.html)))
    check("2. sitemap.xml", !locs.includes(SITE + p.path),
      `${SITE + p.path} is noindex but sitemap.xml lists it.`);
  for (const l of locs)
    check("2. sitemap.xml", pages.some((p) => SITE + p.path === l),
      `sitemap.xml lists ${l}, which is not a built page.`);
  check("2. sitemap.xml", mods.length === locs.length && mods.every(isoOk),
    "every <url> needs a valid <lastmod>.");
  const dm = home && (home.html.match(/"dateModified":"([^"]+)"/) || [])[1];
  const homeMod = (x.match(new RegExp(`<loc>${SITE}/</loc>\\s*<lastmod>([^<]+)</lastmod>`)) || [])[1];
  check("2. sitemap.xml", !dm || homeMod === dm,
    `the home page's sitemap <lastmod> (${homeMod}) and its WebPage dateModified (${dm}) must be the same date; both come from src/lib/lastmod.mjs.`);
}

/* --- 3. every page -------------------------------------------------------- */
for (const { path, html } of pages) {
  const at = `${path}:`;
  const noindex = isNoindex(html);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const title = decode(attr(html, /<title>([\s\S]*?)<\/title>/)).trim();
  const desc = decode(meta(html, "name", "description"));

  check("3. Pages", /<html lang="en-GB"/.test(html), `${at} <html> needs lang="en-GB".`);
  check("3. Pages", /<meta name="viewport"/.test(html), `${at} missing the viewport meta tag.`);
  check("3. Pages", title.length > 0 && title.length <= 70, `${at} title is ${title.length} characters (1-70 wanted): "${title}".`);
  check("3. Pages", (path.startsWith("/blog/") ? desc.length > 0 : desc.length >= 40) && desc.length <= 165, `${at} meta description is ${desc.length} characters (40-165 wanted).`);

  if (noindex) {
    check("3. Pages", !canonical, `${at} is noindex but declares a canonical; a noindex page must not name itself canonical.`);
  } else {
    check("3. Pages", canonical === SITE + path, `${at} canonical is "${canonical}", expected "${SITE + path}".`);
    check("3. Pages", meta(html, "property", "og:url") === canonical, `${at} og:url must equal the canonical.`);
    for (const p of ["og:title", "og:description", "og:image", "og:image:alt", "og:type", "og:site_name"])
      check("3. Pages", meta(html, "property", p).length > 0, `${at} missing <meta property="${p}">.`);
    check("3. Pages", meta(html, "name", "twitter:card") === "summary_large_image", `${at} missing twitter:card=summary_large_image.`);
    const img = meta(html, "property", "og:image");
    check("3. Pages", img.startsWith(SITE + "/"), `${at} og:image must be an absolute URL on ${SITE}: "${img}".`);
    const file = resolve(dist, img.replace(SITE + "/", ""));
    if (existsSync(file)) {
      const { w, h } = imageSize(readFileSync(file));
      check("3. Pages", w === 1200 && h === 630 && meta(html, "property", "og:image:width") === "1200" && meta(html, "property", "og:image:height") === "630",
        `${at} og:image is ${w}x${h} and the width/height tags say ${meta(html, "property", "og:image:width")}x${meta(html, "property", "og:image:height")}; both should be 1200x630.`);
    } else check("3. Pages", false, `${at} og:image points at ${img}, which is not in the build.`);
  }

  const h1s = html.match(/<h1[\s>]/g) || [];
  if (path !== "/404/") check("3. Pages", h1s.length === 1, `${at} has ${h1s.length} <h1>; exactly one is wanted.`);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  check("3. Pages", levels.every((l, i) => i === 0 || l <= levels[i - 1] + 1),
    `${at} heading levels skip (${levels.join(",")}); don't jump from h${levels[0]} to h${levels[0] + 2}.`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  check("3. Pages", !dupes.length, `${at} duplicate id(s): ${[...new Set(dupes)].join(", ")}.`);
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  for (const m of body.matchAll(/href="#([^"]+)"/g))
    check("3. Pages", ids.includes(m[1]), `${at} a link goes to #${m[1]}, but nothing on the page has that id.`);
  /* "/#section" links (the header nav) are checked against the home page's ids. */
  const homeIds = [...(pages.find((p) => p.path === "/")?.html.matchAll(/\sid="([^"]+)"/g) || [])].map((m) => m[1]);
  for (const m of body.matchAll(/href="\/#([^"]+)"/g))
    check("3. Pages", homeIds.includes(m[1]), `${at} a link goes to /#${m[1]}, but the home page has no element with that id.`);
  for (const m of body.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))
    check("3. Pages", /rel="[^"]*noopener/.test(m[0]), `${at} an external link opens a new tab without rel="noopener": ${m[0].slice(0, 90)}`);
  for (const m of body.matchAll(/<img\b[^>]*>/g))
    check("3. Pages", /\salt(?=[\s=>])/.test(m[0]), `${at} an <img> has no alt text: ${m[0].slice(0, 90)}`);
}

/* --- 4. JSON-LD ----------------------------------------------------------- */
if (home) {
  let graph = null;
  try {
    graph = JSON.parse(attr(home.html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/))["@graph"];
  } catch (e) {
    check("4. JSON-LD", false, `the JSON-LD block does not parse: ${e.message}`);
  }
  if (graph) {
    const ids = graph.map((n) => n["@id"]).filter(Boolean);
    check("4. JSON-LD", ids.length === new Set(ids).size, "two nodes share an @id.");
    /* Every { "@id": X } that is a bare reference must point at a node defined
       in this graph, or it is a dangling edge. */
    const refs = [];
    const scan = (v) => {
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === "object") {
        if (Object.keys(v).length === 1 && v["@id"]) refs.push(v["@id"]);
        else Object.values(v).forEach(scan);
      }
    };
    graph.forEach((n) => Object.entries(n).forEach(([k, v]) => k !== "@id" && scan(v)));
    for (const r of refs) check("4. JSON-LD", ids.includes(r), `a node refers to ${r}, which the graph does not define.`);

    const orgs = graph.filter((n) => n["@type"] === "Organization");
    check("4. JSON-LD", orgs.length === 1, `expected exactly one Organization, found ${orgs.length}.`);
    const org = orgs[0] || {};
    check("4. JSON-LD", org["@id"] === ORG_ID, `Organization @id is "${org["@id"]}"; it must be ${ORG_ID} so this graph and certonymity.com's describe one organisation.`);
    check("4. JSON-LD", org.url === sites.company.url, `Organization url is "${org.url}"; the company's site is ${sites.company.url}.`);
    check("4. JSON-LD", org.legalName === company.legalName, `Organization legalName is "${org.legalName}", expected "${company.legalName}".`);
    check("4. JSON-LD", org.identifier?.value === company.number, `Organization identifier is "${org.identifier?.value}", expected company number ${company.number}.`);
    check("4. JSON-LD", org.email === company.email, `Organization email is "${org.email}", expected ${company.email}.`);
    check("4. JSON-LD", org.address?.postalCode === company.address.postcode && org.address?.streetAddress === company.address.street,
      "Organization address does not match src/data/company.mjs.");
    const siblings = [sites.self, sites.company, sites.app, sites.cemail].map((s) => s.url);
    for (const s of org.sameAs || [])
      check("4. JSON-LD", !siblings.some((u) => s.startsWith(u.replace(/\/$/, ""))),
        `Organization.sameAs contains ${s}, a sibling site. sameAs means "is the same entity"; the sites are different things made by one company. Express that with publisher/provider/relatedLink.`);
    const site = graph.find((n) => n["@type"] === "WebSite");
    check("4. JSON-LD", site?.publisher?.["@id"] === ORG_ID, "WebSite.publisher must reference the Organization.");
    const wp = graph.find((n) => n["@type"] === "WebPage");
    check("4. JSON-LD", wp?.url === SITE + "/", `WebPage.url is "${wp?.url}", expected the canonical.`);
    check("4. JSON-LD", isoOk(wp?.dateModified || "") && Date.parse(wp.dateModified) <= Date.now() + 60000,
      `WebPage.dateModified "${wp?.dateModified}" must be a valid, non-future ISO date.`);
    check("4. JSON-LD", (wp?.relatedLink || []).includes(sites.app.url), `WebPage.relatedLink must include the app site ${sites.app.url}.`);
    for (const n of graph.filter((n) => n["@type"] === "SoftwareApplication"))
      check("4. JSON-LD", n.provider?.["@id"] === ORG_ID, `${n.name}: provider must reference the Organization.`);
    const http = JSON.stringify(graph).match(/"http:\/\/[^"]+/g);
    check("4. JSON-LD", !http, `non-https URL in the JSON-LD: ${http && http[0]}`);
  }
}

/* --- 5. company data, and email shielding --------------------------------- */
if (home) {
  const text = home.html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  check("5. Company", text.includes(registrationLine), `the footer must say "${registrationLine}".`);
  for (const part of [company.legalName, company.address.street, company.address.locality, company.address.postcode])
    check("5. Company", text.includes(part), `the contact box/footer is missing "${part}" (src/data/company.mjs).`);
  check("5. Company", text.includes(`© ${new Date().getFullYear()}`), "the footer copyright year is not the current year; rebuild.");

  /* Cloudflare rewrites a plain email in HTML to "[email protected]" for any
     client without JavaScript - which includes most crawlers and AI agents. The
     <!--email_off--> wrapper opts out. Strip the wrapped parts and scripts, and
     nothing email-shaped may remain. */
  const exposed = home.html
    .replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/\splaceholder="[^"]*"/g, ""); /* Cloudflare leaves attribute values alone */
  const emails = exposed.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  check("5. Company", emails.length === 0, `an email address is on the page outside <!--email_off-->, so Cloudflare will turn it into "[email protected]": ${emails.join(", ")}`);
  const all = home.html.replace(/\splaceholder="[^"]*"/g, "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  check("5. Company", all.every((e) => e === company.email), `the page has an email other than ${company.email}: ${[...new Set(all)].join(", ")}`);
}

/* --- 6. llms.txt and the relationships ------------------------------------ */
{
  const l = read("llms.txt");
  const flat = l.replace(/\s*\n\s*/g, " ");
  check("6. llms.txt", l.startsWith("# "), "llms.txt must start with a '# ' title.");
  check("6. llms.txt", /\n>\s/.test(l), "llms.txt needs the '> ' one-paragraph summary.");
  check("6. llms.txt", flat.includes(company.number) && flat.includes(company.jurisdiction), `llms.txt is missing the company number ${company.number} / ${company.jurisdiction}.`);
  check("6. llms.txt", flat.includes(addressLine), `llms.txt is missing the registered office "${addressLine}".`);
  check("6. llms.txt", flat.includes(company.email), `llms.txt is missing ${company.email}.`);
  for (const s of relatedSites) {
    check("6. llms.txt", flat.includes(s.url), `llms.txt does not link ${s.name} (${s.url}).`);
    check("6. llms.txt", flat.includes(s.llms), `llms.txt does not link ${s.name}'s own llms.txt (${s.llms}).`);
  }
  check("6. llms.txt", /How the cDot sites and Certonymity relate/.test(l), "llms.txt lost its section explaining how the sites relate.");
  check("6. llms.txt", !/ Not yet released\./.test(flat) === sites.app.live,
    `sites.app.live is ${sites.app.live} but llms.txt ${sites.app.live ? "still says the app is not yet released" : "does not say the app is not yet released"}.`);
}

/* --- 8. the FAQ: page, structured data and llms.txt are one list ---------- */
if (home) {
  const items = [...home.html.matchAll(/<details class="faq-item">\s*<summary>\s*<span>([\s\S]*?)<\/span>[\s\S]*?<div class="faq-a">([\s\S]*?)<\/div>\s*<\/details>/g)]
    .map((m) => ({ q: decode(m[1]).trim(), a: decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() }));
  const ld = JSON.parse(attr(home.html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/))["@graph"].find((n) => n["@type"] === "FAQPage");
  const ldQs = (ld?.mainEntity || []).map((x) => x.name);
  const llmsQs = [...read("llms.txt").matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  check("8. FAQ", items.length > 0, "the page has no FAQ accordion items.");
  check("8. FAQ", !!ld, "the home page has no FAQPage structured data.");
  check("8. FAQ", JSON.stringify(items.map((i) => i.q)) === JSON.stringify(ldQs),
    `the FAQ questions on the page and in the FAQPage JSON-LD differ.\n      page: ${items.map((i) => i.q).join(" | ")}\n      json-ld: ${ldQs.join(" | ")}`);
  check("8. FAQ", JSON.stringify(items.map((i) => i.q)) === JSON.stringify(llmsQs),
    `the FAQ questions on the page and in llms.txt differ.\n      page: ${items.map((i) => i.q).join(" | ")}\n      llms.txt: ${llmsQs.join(" | ")}`);
  for (const i of items)
    check("8. FAQ", i.a.length > 40 && !/^coming soon\.?$/i.test(i.a), `the answer to "${i.q}" is empty or a placeholder.`);
  for (const m of (ld?.mainEntity || []))
    check("8. FAQ", (m.acceptedAnswer?.text || "").length > 40, `the JSON-LD answer to "${m.name}" is empty.`);
}

/* --- 9. the Blog: absent while off, complete while on ---------------------- */
{
  /* The Studio and the site must point at the same Sanity project. The id is
     written in three places (blog.mjs, studio/sanity.config.js, studio/sanity.cli.js)
     because the Studio is built separately; this keeps them from drifting. */
  const idIn = (f) => (readFileSync(resolve(root, f), "utf8").match(/projectId:\s*['"]([^'"]*)['"]/) || [])[1];
  for (const f of ["studio/sanity.config.js", "studio/sanity.cli.js"])
    check("9. Blog", idIn(f) === sanity.projectId || process.env.SANITY_PROJECT_ID,
      `${f} has projectId "${idIn(f)}" but src/data/blog.mjs has "${sanity.projectId}". They must be the same Sanity project.`);
  if (blogLive) check("9. Blog", !!sanity.projectId, "the Blog is on but no Sanity project id is set (src/data/blog.mjs).");
  const blogPages = pages.filter((p) => p.path.startsWith("/blog"));
  const footer = home ? home.html.slice(home.html.indexOf("<footer")) : "";
  if (!blogLive) {
    check("9. Blog", blogPages.length === 0, `the Blog is off (src/data/blog.mjs) but the build contains ${blogPages.map((p) => p.path).join(", ")}.`);
    check("9. Blog", !/href="\/blog\/?"/.test(home?.html || ""), "the Blog is off but the home page links to /blog/.");
    check("9. Blog", /id="blog-soon"/.test(footer), 'the Blog is off, so the footer should show Blog as a "Coming soon" label.');
    check("9. Blog", !/\/blog\//.test(read("llms.txt")) && !/\/blog\//.test(read("sitemap.xml")), "the Blog is off but /blog/ appears in llms.txt or sitemap.xml.");
  } else {
    const index = blogPages.find((p) => p.path === "/blog/");
    const articles = blogPages.filter((p) => p.path !== "/blog/");
    check("9. Blog", !!index, "the Blog is on but /blog/ was not built.");
    check("9. Blog", articles.length > 0, "the Blog is on but no article pages were built.");
    check("9. Blog", /href="\/blog\/"/.test(footer), "the Blog is on, so the footer's Blog entry should link to /blog/.");
    const llms = read("llms.txt");
    for (const p of blogPages) {
      check("9. Blog", llms.includes(SITE + p.path), `llms.txt does not list ${SITE + p.path}.`);
      const ld = JSON.parse(attr(p.html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/))["@graph"];
      if (p.path !== "/blog/") {
        const art = ld.find((n) => n["@type"] === "Article");
        const h1 = decode(attr(p.html, /<h1[^>]*>([\s\S]*?)<\/h1>/)).trim();
        check("9. Blog", art && art.headline === h1, `${p.path}: the Article headline "${art?.headline}" must equal the page's <h1> "${h1}".`);
        check("9. Blog", art && isoOk(art.datePublished || "") && isoOk(art.dateModified || ""), `${p.path}: the Article needs valid datePublished and dateModified.`);
        check("9. Blog", art?.author?.["@id"] === ORG_ID && art?.publisher?.["@id"] === ORG_ID, `${p.path}: the Article's author and publisher must be the company Organization.`);
        check("9. Blog", meta(p.html, "property", "og:type") === "article", `${p.path}: og:type must be "article".`);
        const chains = ld.filter((n) => n["@id"] && /#(c|p|t)-layer$/.test(n["@id"]));
        check("9. Blog", chains.length === 0, `${p.path}: the network's chain nodes belong on the home page only.`);
      }
    }
  }
}

/* --- 7. social image ------------------------------------------------------ */
{
  let src = null;
  try { src = JSON.parse(readFileSync(resolve(root, "brand/og.source.json"), "utf8")); } catch {}
  check("7. Social image", src && src.tagline === tagline,
    `public/assets/og.png was made from "${src ? src.tagline : "(unknown)"}" but the tagline is now "${tagline}". Run \`npm run og\` and commit the new image.`);
}

/* --- report ---------------------------------------------------------------- */
if (failures.length) {
  console.error(`\ncheck-seo: ${failures.length} problem${failures.length === 1 ? "" : "s"} (${passed} checks passed)\n`);
  for (const f of failures) console.error(`  [${f.rule}] ${f.detail}\n`);
  process.exit(1);
}
console.log(`check-seo: all ${passed} checks passed - robots, sitemap, head tags, JSON-LD, company details and llms.txt agree with the site.`);
