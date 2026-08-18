# cdot.world

Marketing site for cDot — the public, live-facing site covering what is
actually shipped. (The broader product vision lives in the separate
`Cdot site (main)` repo.)

Built with [Astro](https://astro.build). Ships **zero client-side framework
code**: the only JavaScript on the page is the contact-form handler and the
C-Layer network map.

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

`dist/` is plain static HTML/CSS/JS — deployable to any static host.

## Structure

```
src/
  layouts/Layout.astro        <head>, JSON-LD, header + footer shell
  pages/index.astro           home page body + the two inline scripts
  components/
    Header.astro              logo lockup + tagline + nav
    Footer.astro              logo + registered address
    LogoSymbol.astro          inline <symbol id="cdot-logo"> sprite
  styles/
    tokens.css                BRAND TOKENS — see below
    global.css                everything else
public/
  assets/                     logos, favicon, earth-texture.jpg (map)
  llms.txt
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

Fonts match the siblings: **Inter** for body, **Darker Grotesque** for display
headings, self-hosted via `@fontsource` (no third-party font CDN).

## The C-Layer map

`index.astro` carries a vanilla port of the c.Email `NetworkMapCore` component
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
the map is already in view, so `/#network` deep links still work. The RGBA
buffer is reduced to a 1-byte-per-pixel land mask and dropped — retaining the
full `ImageData` would hold 8 MB for the life of the page, and the ocean test
moves out of the repaint loop as a side effect.

The map script stays `is:inline`: it is a self-contained IIFE that reads DOM
ids directly, and inlining keeps it out of Astro's module graph.

**Wheel zoom requires ctrl/cmd, and touch pans on two fingers only.** Without
that the map swallows every scroll crossing it and the page cannot be scrolled
past - on mobile, with `touch-action:none`, a reader could get stuck on it
entirely. `.mapvp` uses `touch-action:pan-y` so vertical page scroll always
survives. Don't "fix" the map by making it zoom on a bare wheel event.

The map is keyboard operable: `#mapvp` is focusable, arrows pan, `+`/`-` zoom,
`0` resets. Focusing a node while zoomed in re-centres it, since a focus ring
drawn outside the viewport is invisible.

## Contact form

The form POSTs to a Google Apps Script web app whose source is versioned at
`scripts/contact-form.gs`; that file's header comment carries the full setup and
redeploy procedure. It is a **separate deployment from c.Email's** identical-looking
form, with its own script and spreadsheet, so editing one cannot break the other.

The `/exec` URL in `index.astro` is public by design - the script only appends
rows and has no `doGet`, so holding the URL grants no read access.

Two things that bite: any edit to the `.gs` needs *Deploy > Manage deployments >
new version* or the live endpoint keeps running the old code; and the mail scope
must be granted by running `testEmail` in the editor once, which a web request
cannot trigger itself. Skip it and enquiries save to the sheet while nobody is
notified.

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
| `www.cdot.world` | Own canonical / `og:url` | No |
| `www.w3.org`, `schema.org` | XML namespace + JSON-LD `@context` identifiers | No — never requested |

| `script.google.com` | Contact-form endpoint (own Apps Script deployment) | Yes — on submit only |

No font CDN, no analytics, no tag manager, no third-party scripts or
stylesheets. Fonts are self-hosted via `@fontsource`: Inter (400/500/600/700),
Darker Grotesque (700) for display headings, and Geist Mono (variable, one file
for the whole 100-900 axis) for figures and technical values.

## Known gaps

- **`og.png` is generated, not designed.** `public/assets/og.png` was composed
  from the logo SVG with cairosvg (see git history) so link previews work now.
  It is deliberately plain - logo, tagline, strapline on the brand gradient. A
  designed replacement is welcome; keep it 1200x630 and the tags will pick it up.
- **No `sameAs` in the JSON-LD.** There are no external profiles yet. Add
  LinkedIn / X / GitHub / Companies House URLs when they exist - this is how a
  search engine reconciles "cDot" with a real registered entity.
- **cDot is modelled as the organisation.** The JSON-LD describes Certonymity
  Ltd; cDot itself is a product and arguably wants its own `Product` or
  `WebSite` node rather than living in the org's `description`.
