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

`src/styles/tokens.css` is the brand source of truth for this repo. Brand blue
is **`#566AFD`** — the same value as the logo SVG fill and as `primary-500` in
the `tailwind.config.js` of `Cdot site (main)`, `c.email-website`, and cma's
`desktop/ui`.

**Those four definitions are copies, not a shared package.** Changing a brand
value here means changing it in the sibling repos too, until the tokens are
extracted into something shared.

Fonts match the siblings: **Inter** for body, **Darker Grotesque** for display
headings, self-hosted via `@fontsource` (no third-party font CDN).

## Gotcha: the map scripts must stay `is:inline`

`public/assets/landdots.js` defines `LAND_COLS` / `LAND_ROWS` / `LAND_DOTS` as
globals of a *classic* script. The map code in `index.astro` reads those
globals. Astro bundles `<script>` as ES modules by default, which would scope
them and break the map — so both the `landdots.js` tag and the map script
carry `is:inline`. Don't remove it.

## Known gaps

- **No `og:image`.** Link previews (Slack, LinkedIn, X, iMessage) render as a
  bare text stub. Needs a 1200×630 image.
- **Contact form uses `mailto:`.** It hands off to the visitor's mail client,
  which silently fails for anyone without one configured, and the enquiry is
  lost with no error shown. Wants a real endpoint.
