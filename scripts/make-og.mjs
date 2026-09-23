#!/usr/bin/env node
/**
 * Open Graph card generator.
 *
 * Rebuilds public/assets/og.png - the 1200x630 image every social platform and
 * link-unfurler shows when cdot.world is shared. It is a raster, so unlike the
 * rest of the site it cannot pick up a copy change on its own: when the tagline
 * moves, this has to be re-run or the card keeps showing the old wording.
 *
 * Everything that can be read from source IS read from source - the tagline,
 * the logo, the palette, the gradient - so the card cannot drift from the site
 * the way a hand-exported PNG does.
 *
 * Rendered through headless Chrome rather than an SVG rasteriser because the
 * card sets real text in Host Grotesk, and librsvg/resvg only see fonts that
 * are installed system-wide. Chrome takes the woff2 straight out of
 * node_modules, so it renders with the same engine and the same font file the
 * site itself uses.
 *
 * The layout numbers below were recovered by measuring the original card
 * pixel-by-pixel; rendering the old tagline with them reproduces that file
 * exactly (text box x354-844, y404-436). Treat them as the design, not as
 * arbitrary constants - change them only deliberately.
 *
 * Usage:  npm run og
 *         CHROME=/path/to/chrome npm run og     (non-macOS, or a custom build)
 */
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
/* Not a direct dependency: sharp ships with Astro for image optimisation.
   Only used here to quantise the finished card - see the note further down. */
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

/* --- layout, measured off the original card ----------------------------- */
const W = 1200;
const H = 630;
const LOGO_W = 379; // px; height follows from the symbol's own viewBox
const LOGO_TOP = 195;
const TAG_TOP = 400;
const TAG_SIZE = 34;
const TAG_WEIGHT = 700;
const TAG_TRACKING = 1; // px. Without this the line sets ~6% narrow.
const BAR_H = 4;

/* --- pull the content out of the site ----------------------------------- */
const tagline = read("src/components/Header.astro").match(
  /const tagline\s*=\s*"([^"]+)"/,
)?.[1];
if (!tagline) throw new Error("No `const tagline` found in src/components/Header.astro");

const logo = read("src/components/LogoSymbol.astro").match(
  /<symbol id="cdot-logo" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/,
);
if (!logo) throw new Error("No #cdot-logo <symbol> found in src/components/LogoSymbol.astro");
const [, logoViewBox, logoBody] = logo;

/* The card follows the site's DEFAULT scheme, so that clicking through from a
   social feed does not jump from one palette to the other. That is light, which
   lives on a bare :root.

   Picked by the token it carries, NOT by position: there is more than one bare
   :root block - the brand constants have their own - and "the first --bg-0 in
   the file" would quietly follow whichever scheme happens to be declared first.
   Matched to its own closing brace so it cannot run on into the next block. */
const tokensCss = read("src/styles/tokens.css");
const schemeBlock = (tokensCss.match(/:root\s*\{[^}]*\}/g) || []).find((b) => /--bg-0/.test(b));
if (!schemeBlock) throw new Error("No :root block carrying --bg-0 in src/styles/tokens.css");
const token = (name) => {
  const m = schemeBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${name} not found in the default scheme block of tokens.css`);
  return m[1];
};
const brand = JSON.parse(read("brand/palette.json")).brand.blue;

const font = readFileSync(
  resolve(root, "node_modules/@fontsource-variable/host-grotesk/files/host-grotesk-latin-wght-normal.woff2"),
).toString("base64");

/* The card's background is the hero's own gradient, at the same size and focal
   point, so the card and the page a visitor lands on open with one image. */
const background =
  `radial-gradient(1200px 760px at 70% 18%,` +
  `${token("wash")} 0%,${token("bg-2")} 34%,` +
  `${token("bg-1")} 64%,${token("bg-0")} 100%)`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face{font-family:'HG';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-style:normal}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{position:relative;overflow:hidden;background:${background}}
.logo{position:absolute;left:50%;transform:translateX(-50%);top:${LOGO_TOP}px;width:${LOGO_W}px;display:block}
.tag{position:absolute;left:0;right:0;top:${TAG_TOP}px;text-align:center;font-family:'HG',sans-serif;
     font-weight:${TAG_WEIGHT};font-size:${TAG_SIZE}px;line-height:1;letter-spacing:${TAG_TRACKING}px;color:${brand}}
.bar{position:absolute;left:0;right:0;bottom:0;height:${BAR_H}px;background:${brand}}
</style></head><body>
<svg class="logo" viewBox="${logoViewBox}" xmlns="http://www.w3.org/2000/svg">${logoBody}</svg>
<div class="tag">${tagline}</div>
<div class="bar"></div>
</body></html>`;

/* --- render ------------------------------------------------------------- */
const chrome =
  process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = mkdtempSync(join(tmpdir(), "cdot-og-"));
const page = join(tmp, "og.html");
const shot = join(tmp, "og.png");

try {
  writeFileSync(page, html);
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    /* Without this a HiDPI display yields a 2400x1260 card. */
    "--force-device-scale-factor=1",
    `--screenshot=${shot}`,
    `--window-size=${W},${H}`,
    `file://${page}`,
  ], { stdio: "pipe" });

  /* Chrome dithers its gradients, and that noise defeats PNG's row filters -
     straight RGB lands around 178KB. Quantising to a dithered 256-colour
     palette roughly halves it with no visible banding and no shift in the
     brand blue, which is flat enough to survive as an exact palette entry. */
  const out = resolve(root, "public/assets/og.png");
  const { size } = await sharp(shot)
    .png({ palette: true, colors: 256, effort: 10 })
    .toFile(out);

  console.log(`og.png  ${W}x${H}  ${(size / 1024).toFixed(1)}KB`);
  console.log(`tagline "${tagline}"`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
