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
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run brand:check` | Verify the brand tokens against `brand/palette.json` and the sibling repos |
| `npm run check:sync` | After a build: verify the page, meta tags, JSON-LD and `llms.txt` still agree (see "One source of truth") |
| `npm run deploy` | Build, then publish `dist/` to production with wrangler. **See the warning under "Deploying".** |

`dist/` is plain static HTML/CSS/JS — deployable to any static host.

## Deploying

**This site requires a build step.** `dist/` is gitignored, and there is no
`index.html` at the repo root, so a host configured to serve the repository root
verbatim will 404. Whatever the host, it needs:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
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
  pages/
    index.astro               the page body + one inline script (both forms)
    llms.txt.ts               generates /llms.txt (the chain section is built from data/)
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
  robots.txt
brand/palette.json            canonical brand definition
scripts/
  check-brand.mjs             `npm run brand:check`
  check-sync.mjs              `npm run check:sync`: do the messaging surfaces agree?
  contact-form.gs             source of the contact-form Apps Script (not built)
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

## Crawler policy

`public/robots.txt` deliberately splits two things people conflate: retrieval
and training. Search/citation agents (`OAI-SearchBot`, `ChatGPT-User`,
`Claude-SearchBot`, `Claude-User`, `PerplexityBot`) are **allowed**, so
assistants can read the page and link back to it. Training crawlers and opt-out
tokens (`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`,
`Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`) are **disallowed**.

Two things to keep straight if you edit it. `Google-Extended` and
`Applebot-Extended` are not crawlers and have no effect on Google or Apple
search ranking - Googlebot and Applebot are separate and still allowed. And
robots.txt is a request, not enforcement: it states intent and well-behaved
operators honour it, but nothing stops a scraper.

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

- **`og.png` is generated, not designed.** `public/assets/og.png` was composed
  from the logo SVG with cairosvg (see git history) so link previews work now.
  It is deliberately plain - logo, tagline, strapline on the brand gradient. A
  designed replacement is welcome; keep it 1200x630 and the tags will pick it up.
- **`og.png` still carries the old tagline** ("Secure identity and payments") as
  pixels, so link-preview art and text disagree until it is regenerated.
- **`sameAs` is partial.** The Organization lists its LinkedIn page and
  certonymity.com. Add X / GitHub / Companies House / community channels when
  they exist and are confirmed - a wrong `sameAs` can merge your entity with
  someone else's, which is worse than none. `cdot.app` is deliberately *not* in
  it: that is a different thing (the product), expressed with `relatedLink`.
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
`sameAs` and a `contactPoint`), a `WebSite`, a `SoftwareApplication` for cDot, one
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
