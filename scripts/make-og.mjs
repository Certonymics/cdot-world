/* ---------------------------------------------------------------------------
   `npm run og` - regenerates public/assets/og.png (the social-share card).

   The card carries the header tagline as PIXELS, so when the tagline changed the
   image kept the old wording and no check could notice. Now the image is made
   from src/data/company.mjs's tagline, and brand/og.source.json records which
   tagline the committed PNG was made from; `npm run check:seo` fails if the two
   differ, which is the prompt to run this again.

   It renders an HTML page in headless Chrome (macOS path below, or set CHROME).
   Needed only when the tagline changes, so it is a local step, not part of CI.
--------------------------------------------------------------------------- */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tagline } from "../src/data/company.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const chrome = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* The lockup is the same <symbol> the site uses, so the card cannot drift from
   the logo either. */
const sprite = readFileSync(resolve(root, "src/components/LogoSymbol.astro"), "utf8");
const symbol = sprite.match(/<symbol[\s\S]*?<\/symbol>/)[0];
const font = pathToFileURL(
  resolve(root, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"),
).href;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:G;src:url("${font}");font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:G,sans-serif;color:#566AFD;
  background:radial-gradient(ellipse 60% 55% at 68% 18%,#0d2145 0%,rgba(13,33,69,0) 70%),linear-gradient(#0a1830,#040b18);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;padding-bottom:6px}
svg.l{width:380px;height:auto;aspect-ratio:61.93/25.63}
p{font-size:34px;font-weight:600;letter-spacing:-.005em}
.bar{position:absolute;left:0;right:0;bottom:0;height:6px;background:#566AFD}
</style>
<svg width="0" height="0">${symbol}</svg>
<svg class="l" viewBox="0 0 61.93 25.63"><use href="#cdot-logo"/></svg>
<p>${tagline}</p><div class="bar"></div>`;

const dir = mkdtempSync(join(tmpdir(), "cdot-og-"));
const src = join(dir, "og.html");
writeFileSync(src, html);
const out = resolve(root, "public/assets/og.png");
execFileSync(
  chrome,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
   "--window-size=1200,630", `--screenshot=${out}`, pathToFileURL(src).href],
  { stdio: "ignore" },
);
writeFileSync(resolve(root, "brand/og.source.json"), JSON.stringify({ tagline }, null, 2) + "\n");
console.log(`og: wrote public/assets/og.png for "${tagline}"`);
