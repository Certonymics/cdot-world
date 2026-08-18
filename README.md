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
  assets/                     logos, favicon, landdots.js (map data)
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

## Gotcha: the map scripts must stay `is:inline`

`public/assets/landdots.js` defines `LAND_COLS` / `LAND_ROWS` / `LAND_DOTS` as
globals of a *classic* script. The map code in `index.astro` reads those
globals. Astro bundles `<script>` as ES modules by default, which would scope
them and break the map — so both the `landdots.js` tag and the map script
carry `is:inline`. Don't remove it.

## External dependencies

The site is self-hosted apart from one first-party API call:

| Reference | What it is | Fetched at runtime? |
|---|---|---|
| `map.c-layer.certonym.org` | Live C-Layer node data for the network map (own infrastructure) | Yes — degrades to static copy on failure |
| `www.cdot.world` | Own canonical / `og:url` | No |
| `www.w3.org`, `schema.org` | XML namespace + JSON-LD `@context` identifiers | No — never requested |

No font CDN, no analytics, no tag manager, no third-party scripts or
stylesheets. Fonts are self-hosted via `@fontsource`.

## Known gaps

- **No `og:image`.** Link previews (Slack, LinkedIn, X, iMessage) render as a
  bare text stub. Needs a 1200×630 image.
- **Contact form uses `mailto:`.** It hands off to the visitor's mail client,
  which silently fails for anyone without one configured, and the enquiry is
  lost with no error shown. Wants a real endpoint.
