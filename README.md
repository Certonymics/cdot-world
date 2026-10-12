# cdot.world

Built with [Astro](https://astro.build). Ships **zero client-side framework
code**: the only JavaScript on the page is one small inline script for the two
forms (contact and C-Layer node signup) and the C-Layer network map.

**This site is the network and the foundation** - the concept, the mission, and
the open-source work behind cDot. The product, the cDot app, lives at
[cdot.app](https://cdot.app). They are one product seen from two sides and share a
mark, a palette and a typeface pair; **light versus dark is the whole difference**
(see "Dark only" below).

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
```

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `dist/`, then writes the security headers (see "Security headers") |
| `npm run preview` | Serve the built `dist/` |
| `npm run brand:check` | Verify the brand tokens against `brand/palette.json` and the sibling repos |
| `npm run check:sync` | After a build: verify the page, meta tags, JSON-LD and `llms.txt` still agree (see "One source of truth") |
| `npm run check:seo` | After a build: verify robots.txt, the sitemap, head tags, JSON-LD, company details and `llms.txt` (see "SEO and the relationships between our sites") |
| `npm run check:live` | Ask the live web: is the deployed site current, do our links resolve, does certonymity.com still describe us the same way |
| `npm run og` | Regenerate the social-share image from the current tagline (needs Chrome; run when the tagline changes) |
| `npm run deploy` | Build, then publish `dist/` to production with wrangler. **See the warning under "Deploying".** |

`dist/` is plain static HTML/CSS/JS — deployable to any static host.

## Deploying

**This site requires a build step.** `dist/` is gitignored, and there is no
`index.html` at the repo root, so a host configured to serve the repository root
verbatim will 404. Whatever the host, it needs:

| Setting | Value |
|---|---|
| Build command | `npm run build` — **not** `astro build` on its own: the headers step is part of the script |
| Output directory | `dist` |
| Node version | **22.12.0 or later** — pinned in `.nvmrc` |

The site is fronted by Cloudflare and served from the apex, `cdot.world`;
`www.cdot.world` 301-redirects to it. `astro.config.mjs` sets `site` to the apex
to match, because `site` is what generates the `canonical` and `og:url` tags — if
they name a hostname that redirects, crawlers are told the canonical URL is one
the server itself disavows. **Keep `site` in step with whichever hostname actually
serves the page.**

Astro 7 requires Node >= 22.12.0, which is newer than some hosts default to, so
`.nvmrc` pins it. Cloudflare Pages reads that file; keeping the version in the
repo rather than a dashboard field means the requirement travels with the code.

Production is the Cloudflare Pages project **`cdot-world`** (Workers & Pages ->
filter by Pages, not Workers - Pages projects do not appear under Workers). It
builds the `main` branch and also gives every other branch its own preview URL,
which is the cheap way to check a change before merging.

**`npm run deploy` is a second, direct route to production.** It builds the
working tree and uploads it with `wrangler pages deploy --branch=main
--commit-dirty=true`, so it publishes whatever is on your machine - another
branch, uncommitted edits, unpushed commits - with no checks and no review. It
does not run `brand:check`. Use it knowingly, from a clean checkout of `main`.

Predecessor note: this repo previously held a hand-written `index.html` at the
root with no build step. If a deploy starts 404ing after a change, check the
host's build configuration before the code.

## Structure

```
src/
  layouts/Layout.astro        <head>, JSON-LD, header + footer shell
  data/network.mjs            THE CHAINS' FACTS - specs, status, descriptions (see below)
  data/company.mjs            THE COMPANY'S FACTS and how the sites relate (see below)
  lib/lastmod.mjs             date of the last content commit (dateModified + sitemap)
  pages/
    index.astro               the page body + one inline script (both forms)
    llms.txt.ts               generates /llms.txt (chains, company, related sites: all from data/)
    sitemap.xml.ts            generates /sitemap.xml from the pages that exist
    404.astro                 not-found page; noindex, no canonical
  components/
    Header.astro              logo lockup + tagline + nav + mobile menu script
    Footer.astro              logo, contact email, c.Email link, copyright
    LogoSymbol.astro          inline <symbol id="cdot-logo"> sprite
  styles/
    tokens.css                BRAND TOKENS — see below
    global.css                everything else
public/
  assets/                     logos, favicon, earth-texture.jpg, map.js
  _headers                    Cloudflare response headers (CSP placeholder inside)
  robots.txt
brand/palette.json            canonical brand definition
scripts/
  check-brand.mjs             `npm run brand:check`
  build-headers.mjs           writes the Content-Security-Policy after the build
  check-sync.mjs              `npm run check:sync`: do the messaging surfaces agree?
  check-seo.mjs               `npm run check:seo`: robots, sitemap, head, JSON-LD, company facts
  check-live.mjs              `npm run check:live`: the deployed site and our links
  make-og.mjs                 `npm run og`: renders public/assets/og.png from the tagline
  contact-form.gs             source of the contact-form Apps Script (not built)
brand/og.source.json          which tagline og.png was made from (checked by check:seo)
.github/workflows/ci.yml      automatic checks on every PR
.github/workflows/live-check.yml  weekly check of the live site and our links
```

To add a page, drop a `.astro` file in `src/pages/` and wrap it in `Layout`.
Header and footer come along automatically.

## Brand tokens

`brand/palette.json` is the canonical brand definition. `src/styles/tokens.css`
derives from it. Brand blue is **`#566AFD`** — the same value as the logo SVG
fill and as `primary-500` in the `tailwind.config.js` of `Cdot site (main)`,
`c.email-website`, and cma's `desktop/ui`.

Those four definitions are still **copies, not a shared package**, so they can
drift. To catch that:

```bash
npm run brand:check
```

It verifies every consumer against `brand/palette.json` and flags near-miss
hexes — a colour close enough to the brand blue to be a typo rather than a
deliberate palette step. Exits non-zero on drift, so it can gate CI or a
pre-commit hook. Sibling repos that aren't checked out are skipped, not failed.

The real fix is one shared package all four repos import; that needs a decision
on where it lives.

Fonts are **Geist** for body, **Host Grotesk** for display headings (H1/H2), and
**Geist Mono** for figures — all self-hosted via `@fontsource` (no third-party
font CDN). This is the same pair cdot.app uses, on purpose, and it is what
`brand/palette.json` names. (The palette used to say Inter and Darker Grotesque,
which no site ever loaded.)

### Dark only

There is **no light theme, no toggle, and no `prefers-color-scheme` branch**. That
is a brand decision, not a gap: cdot.app is the light surface and this is the dark
one. `npm run brand:check` fails if a `:root[data-theme="light"]` block or a
`prefers-color-scheme` query comes back, and it checks that the hardcoded
`theme-color` meta tag still matches `--bg-0`. Colours are still stored as RGB
channel triplets (`--accent-rgb` and friends) so a second theme would be cheap if
one ever returned - but add it deliberately, with a parity check.

Form-field borders use `--field-border`, not `--line`: `--line` is a decorative
hairline at 1.3:1, and the edge of an input needs 3:1 (WCAG 1.4.11).

## The C-Layer map

`index.astro` holds the markup and `public/assets/map.js` the script: a vanilla
port of the c.Email `NetworkMapCore` component
(`c.email-website/src/components/NetworkMapCore.jsx`) — same projection, same
sampling, same interactions, restyled dark and written without React/Tailwind,
which this site does not use. **Keep the two in step when either changes.**

The continents are sampled at runtime from `public/assets/earth-texture.jpg`
and the dot field is re-drawn for the current view, so the dots stay a constant
screen size instead of scaling and blurring. That is why the land `<canvas>`
sits *outside* `#maplayer`: only the node markers are CSS-transformed.

The texture is downscaled to 2048x1024 (492 KB) from c.Email's 4096x2048
(1.4 MB). The dot grid samples ~230 columns, so 2048 is still oversampled at
maximum zoom; going below ~1024 would start to look blocky when zoomed in.

`getImageData` on the texture requires it to be same-origin — keep it served
from `/assets/`, not a CDN. The read is wrapped so a future CDN move warns to
the console instead of leaving a silently blank map.

The texture fetch is deferred by an `IntersectionObserver` on `#mapvp`
(`rootMargin: 200px`), because it is ~480 KB and would otherwise compete for
bandwidth with the CSS and fonts the hero needs. Observing fires immediately if
the map is already in view, so `/#c-layer` deep links still work. The RGBA
buffer is reduced to a 1-byte-per-pixel land mask and dropped — retaining the
full `ImageData` would hold 8 MB for the life of the page, and the ocean test
moves out of the repaint loop as a side effect.

The map script lives at `public/assets/map.js` and loads with `defer`. It is a
self-contained IIFE that reads DOM ids directly, so it stays out of Astro's
module graph either way; serving it from `public/` rather than inlining keeps the
page's prose dominant in the markup, which matters for naive text extractors.
`defer` guarantees the elements it queries have parsed.

**Wheel zoom requires ctrl/cmd, and touch pans on two fingers only.** Without
that the map swallows every scroll crossing it and the page cannot be scrolled
past - on mobile, with `touch-action:none`, a reader could get stuck on it
entirely. `.mapvp` uses `touch-action:pan-y` so vertical page scroll always
survives. Don't "fix" the map by making it zoom on a bare wheel event.

The map is keyboard operable: `#mapvp` is focusable, arrows pan, `+`/`-` zoom,
`0` resets. Focusing a node while zoomed in re-centres it, since a focus ring
drawn outside the viewport is invisible.

## Forms

There are two, both handled by one inline script at the bottom of `index.astro`
that shares a `postJson()` helper. Both POST JSON to a Google Apps Script web app,
send no `Content-Type` header (Apps Script does not answer the preflight request
that header would trigger), time out after 15 seconds, and only report success if
the server explicitly said `ok: true`. Both forms carry `method="post"`, so if the
script ever failed to attach, an email address would be sent in the body rather
than appended to the URL.

### Contact form

The form POSTs to a Google Apps Script web app whose source is versioned at
`scripts/contact-form.gs`; that file's header comment carries the full setup and
redeploy procedure. It is a **separate deployment from c.Email's** identical-looking
form, with its own script and spreadsheet, so editing one cannot break the other.

**The address copied on every enquiry is not in this repo.** The repository is
public, so `CC_ADDRESS` is an Apps Script *script property* (Project Settings ->
Script properties), read at run time. Unset, no copy is sent - and the owner's
Inbox quietly stops receiving enquiries, because Gmail does not deliver a
sender's own group mail to their Inbox. `testEmail()` warns when it is missing.
Set it before deploying a new version of the script.

The `/exec` URL in `index.astro` is public by design - the script only appends
rows and has no `doGet`, so holding the URL grants no read access.

Two things that bite: any edit to the `.gs` needs *Deploy > Manage deployments >
new version* or the live endpoint keeps running the old code; and the mail scope
must be granted by running `testEmail` in the editor once, which a web request
cannot trigger itself. Skip it and enquiries save to the sheet while nobody is
notified.

### C-Layer node signup

A second Apps Script deployment, shared with cdot.app and c.email-website, so a
signup from any of the three lands in one sheet. Its source is not in this repo.
The signup handler began as a verbatim port from cdot.app and has since diverged
(it resets the button label on success, and uses `postJson()`); cdot.app still has
the old inline version. Port the changes there when it is next touched.

## Security headers

`public/_headers` sets the response headers on Cloudflare Pages: HSTS (use HTTPS
for a year), `X-Frame-Options: DENY` (no framing by other sites), a
`Permissions-Policy` switching off features the site never uses, a
`Content-Security-Policy`, and a one-year `immutable` cache on `/_astro/*` (those
filenames carry a content hash, so they can never go stale). The file's header
comment explains each one. **They only apply on Cloudflare** - `npm run dev` and
`npm run preview` do not read it.

**The Content-Security-Policy is generated, not written.** The page has inline
scripts (the mobile menu, the forms), and a strict policy can only allow those by
SHA-256 hash. `scripts/build-headers.mjs` runs after `astro build`, hashes each
inline script in the built HTML, and replaces the `__CSP__` placeholder in
`dist/_headers`. Edit an inline script and rebuild, and the policy follows; paste a
policy in by hand and the first edit silently blocks that script.

The same script **fails the build** if the page contains anything the policy
would block: an inline `style="..."` attribute, a `<style>` block, an inline
`onclick=`-style handler, or a `<script src>` from another origin. Use a class, a
CSS rule, or `addEventListener` instead. That is deliberate: a form that breaks
silently in production is much worse than a failed build.

**If the page's JavaScript starts talking to a new outside origin, add it to
`CONNECT_ORIGINS` in `build-headers.mjs`** or the browser will refuse the request.
Today that is `script.google.com` (the forms), `script.googleusercontent.com`
(where Google *redirects* the response - a redirect is checked at every hop, so
leaving it out would break every submission), and `map.c-layer.certonym.org`.

To check the headers on a deployed URL (a branch preview works):

```bash
curl -sI https://<preview-or-production-url>/ | grep -iE 'strict-transport|content-security|x-frame|permissions'
curl -sI https://<preview-or-production-url>/_astro/<any-hashed-file> | grep -i cache-control
```

## Automatic checks

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` and
`astro-port`: `npm ci`, `npm run brand:check`, `npm run build`, a check that the
policy was actually written, `check:sync` (messaging) and `check:seo` (everything
around it), and an informational `npm audit` that reports but
never fails the job. It does not deploy. It is also what lets a Dependabot update
PR show a pass or fail before anyone merges it.

`.github/workflows/live-check.yml` runs weekly (and on demand) and asks the live
web instead: see "SEO and the relationships between our sites". Its failures mean
something out there broke - a dead link, a deploy that never went out - not that a
pull request is wrong.

## Crawler policy

`public/robots.txt` allows every crawler, **including the ones that gather model
training data**. This is a public project site whose purpose is to be found and
built on, so nothing is withheld. It used to split retrieval from training
(allowing `OAI-SearchBot`, `Claude-SearchBot` and similar, but disallowing
`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`,
`Meta-ExternalAgent` and `Bytespider`); that opt-out was removed on purpose.
`check:seo` fails if any named AI crawler is blocked again, so a re-added line is a
conscious change rather than an accident. Remember robots.txt is a request, not
enforcement, in either direction.

The file points at `/sitemap.xml`. A robots.txt only governs the host that serves
it, so it cannot be "linked" to the other sites': certonymity.com, c.email and
cdot.app each publish their own, and all of them now state the same allow-all
policy.

## External dependencies

The site is self-hosted apart from one first-party API call:

| Reference | What it is | Fetched at runtime? |
|---|---|---|
| `map.c-layer.certonym.org` | Live C-Layer node data for the network map (own infrastructure) | Yes — degrades to static copy on failure |
| `cdot.world` | Own canonical / `og:url` | No |
| `www.w3.org`, `schema.org` | XML namespace + JSON-LD `@context` identifiers | No — never requested |
| `script.google.com` | Contact-form and node-signup endpoints (two separate Apps Script deployments) | Yes — on submit only |
| `cdot.app`, `c.email`, `certonymity.com` | Outbound links to the sibling product sites and the company site | No — links only |

No font CDN, no analytics, no tag manager, no third-party scripts or
stylesheets. Fonts are self-hosted via `@fontsource`, all three variable (one
file per subset for the whole weight axis): Geist for body, Host Grotesk for
display headings, and Geist Mono for figures and technical values.

## Known gaps

- **`og.png` is generated, not designed.** `npm run og` renders it from the logo
  and the current tagline in headless Chrome. It is deliberately plain - logo,
  tagline, strapline on the brand gradient. A designed replacement is welcome;
  keep it 1200x630 and the tags will pick it up (and set `tagline` in
  `brand/og.source.json` so `check:seo` knows what it says).
- **`sameAs` is minimal.** The Organization lists only its LinkedIn page. Add X /
  GitHub / community channels when they exist and are confirmed - a wrong `sameAs`
  can merge your entity with someone else's, which is worse than none. No sibling
  site belongs in it (see below); `check:seo` fails if one is added.
- **Map, mobile:** the node markers are 10x10px touch targets (WCAG 2.2 wants 24),
  all individually focusable; the 2048x1024 texture is decoded to ~8 MB on the
  device to produce a land/ocean mask that could ship pre-baked at a fraction of
  the size.
- **Map, backend:** every page view makes 31 requests to the node registry - one
  list call, then up to 30 geolocation lookups in sequence, uncached. A
  rate-limited backend means a handful of concurrent visitors can empty the map.
  The real fix is server-side (return coordinates, or an aggregate endpoint).

## Structured data

`Layout.astro` emits a JSON-LD `@graph`: the `Organization` (Certonymity Ltd, with
its Companies House number, `sameAs` and a `contactPoint`), a `WebSite`, a `SoftwareApplication` for cDot, one
`SoftwareApplication` per chain linked to the parent by `isPartOf` / `hasPart`,
and a `WebPage` (omitted on the 404). Each chain carries its specifications as
`PropertyValue` entries with a numeric `value` and a `unitText`, so throughput and
finality figures are machine-comparable instead of buried in a prose
`description`, plus a `Status` (Live / Launching soon) so an answer engine does not
quote a chain's figures as if it were live.

The `WebPage` `dateModified` is the date of the last git commit touching `src/` or
`public/`, not the build time: a build stamp would claim the page changed on every
deploy. It falls back to the build time only where git is unavailable.

## One source of truth

The same messaging used to be written out by hand in several places and drifted
every time it moved: the tagline in `llms.txt`, a stale JSON-LD description, a
launch status that still read as live. It is now two layers.

**Facts are generated, from `src/data/network.mjs`.** Each chain's description,
launch status and specifications are written there once. The cards on the page,
the JSON-LD `SoftwareApplication` nodes (including each chain's `Status`), the
cDot node's "launching soon" clause, and the chain section of `/llms.txt` are all
built from it. To change a throughput figure or launch a chain, edit that one file
and rebuild. The page and the structured data come out identical to the
hand-written versions they replaced - that was checked byte for byte when it was
introduced.

**Prose is hand-written and checked.** The hero, the Mission copy, the tagline and
the use-case pills cannot be generated - they are copy. After a build,
`npm run check:sync` reads `dist/` and fails if they disagree: the tagline against
the title and og tags; the hero's first sentence against the meta description, the
JSON-LD and `llms.txt`; the H1 and every Mission sentence against `llms.txt` (and
the reverse, so a sentence deleted from the page cannot linger there); the pills
against the "Use cases" line; and the chains' status and specs across all of them.
It names what disagrees and which file to change. It runs in CI. It can say the
copy is *consistent*, never that it is *good*.

When it fails after you edit the page, the usual fix is to bring the same wording
into `src/pages/llms.txt.ts`. A sentence that belongs only in `llms.txt` (like the
"built by the team behind c.Email" line) goes in `LLMS_ONLY` in the script, with a
reason.

## SEO and the relationships between our sites

Four sites, one company:

| Site | What it is | In the graph as |
|---|---|---|
| certonymity.com | The company, Certonymity Ltd | the `Organization` (`@id` `https://certonymity.com/#organization`) |
| **cdot.world** (this) | The cDot **network**: concept, mission, foundation, SDKs, the C-Layer | `WebSite` + `SoftwareApplication` `#cdot` and one node per chain |
| cdot.app | The cDot **app**, the product built on the network. *Not live yet.* | `relatedLink` from our `WebPage`; its own graph says `isBasedOn` our `#cdot` |
| c.email | The company's first product, built on the cDot framework | named in `llms.txt` |

They are different things, so none is `sameAs` another (`sameAs` means "is the
same entity" and a wrong one can merge entities that are not one). What ties them
together is **one Organization node with the same `@id` on every site** (the
company's own, as certonymity.com publishes it), `publisher`/`provider` pointing at
it, `relatedLink` between sites, and the relationships spelled out in prose in
`/llms.txt` ("How the cDot sites and Certonymity relate").

**`src/data/company.mjs` is the one place** the company's legal name, number,
registered office, email, LinkedIn, tagline and the sibling sites (with whether each
is live) are written. The footer, contact box, JSON-LD, `llms.txt` and the checks all
read it. To launch the app site, set `sites.app.live = true` there: `llms.txt` drops
"not yet released" and `check:live` starts treating `cdot.app` as a real link.

What updates itself: the sitemap (from the pages that exist, with `<lastmod>` from
the last content commit), the WebPage `dateModified`, the footer's copyright year,
`llms.txt`'s company and related-site sections, and the JSON-LD organisation. What is
checked rather than generated (`npm run check:seo`, in CI): robots.txt policy and
sitemap pointer; every indexable page in the sitemap and nothing noindex; title,
description, canonical, og/twitter tags and the 1200x630 image on every page; one
`<h1>`, no skipped heading levels, no duplicate ids, every `#anchor` resolving,
`rel=noopener` on new-tab links; JSON-LD ids unique with no dangling references;
the company facts everywhere they appear; and that the social image was made from
the current tagline (otherwise: `npm run og`).

**Email addresses are wrapped in `<!--email_off-->`.** Cloudflare's email
obfuscation otherwise rewrites a plain address to "[email protected]" for any
client without JavaScript, which includes most crawlers and AI agents, so the page
would have advertised no contact address to them. `check:seo` fails on any address
outside the wrapper.

**FAQ.** The questions and answers live in `src/data/faq.mjs`. The accordion, the
`FAQPage` structured data and the FAQ section of `/llms.txt` are all built from it,
and `check:seo` fails if the three differ or an answer is empty. Answers are small
HTML strings; `%EMAIL%` stands for the company address (shielded from Cloudflare's
obfuscation on the page, plain in the markup).

**Things outside this repo.** `certonymity.com` currently lists
`sameAs: https://cdot.world/#certonymity`, a node this site no longer defines (the
Organization is now the shared company `@id`), and describes the cDot *app* as being
at cdot.world; `check:live` reports both as warnings each week until they are
updated there. cdot.app's schema uses its own organisation `@id`
(`https://cdot.app/#certonymity`) and should adopt `ORG_ID` too.
