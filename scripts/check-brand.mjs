#!/usr/bin/env node
/**
 * Brand drift check.
 *
 * The brand blue is defined in four separate repos (see brand/palette.json
 * "consumers"). They are copies, not a shared package, so they can drift
 * silently. This script makes drift loud.
 *
 * It checks each consumer file for:
 *   1. the canonical brand blue being present at all
 *   2. near-miss hexes - colours close enough to the brand blue to be a typo
 *      rather than a deliberate palette step (e.g. #556AFD, a digit swap)
 *
 * Exits non-zero if anything is wrong, so it can gate a commit or CI run.
 * Missing sibling repos are skipped, not failed - not everyone has all four
 * checked out.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const palette = JSON.parse(readFileSync(resolve(root, "brand/palette.json"), "utf8"));

const BRAND = palette.brand.blue.toUpperCase();
const KNOWN = new Set(
  [...Object.values(palette.primary), ...Object.values(palette.secondary)].map((h) =>
    h.toUpperCase(),
  ),
);

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const distance = (a, b) => {
  const [x, y, z] = rgb(a);
  const [p, q, r] = rgb(b);
  return Math.sqrt((x - p) ** 2 + (y - q) ** 2 + (z - r) ** 2);
};

// Close enough to the brand blue to be a mistake rather than a design choice.
// The nearest legitimate palette step (primary-600 #4A5AE8) sits at ~26, so
// anything under 20 that is not itself a known step is suspicious.
const TYPO_RADIUS = 20;

let failures = 0;
let skipped = 0;

console.log(`\ncDot brand check - canonical brand blue ${BRAND}\n`);

for (const { name, path } of palette.consumers) {
  const abs = resolve(root, path);
  if (!existsSync(abs)) {
    console.log(`  ~  ${name}\n     skipped, not found at ${path}`);
    skipped++;
    continue;
  }

  const src = readFileSync(abs, "utf8");
  const hexes = [...src.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase());
  const problems = [];

  if (!hexes.includes(BRAND)) {
    problems.push(`brand blue ${BRAND} not found`);
  }

  const typos = [...new Set(hexes)].filter(
    (h) => h !== BRAND && !KNOWN.has(h) && distance(h, BRAND) < TYPO_RADIUS,
  );
  for (const t of typos) {
    problems.push(`${t} is suspiciously close to ${BRAND} (distance ${distance(t, BRAND).toFixed(1)}) - typo?`);
  }

  if (problems.length) {
    failures++;
    console.log(`  X  ${name}  (${path})`);
    for (const p of problems) console.log(`     - ${p}`);
  } else {
    console.log(`  OK ${name}`);
  }
}

/* ---------------------------------------------------------------------------
   Dark only.

   The site ships ONE palette. The light theme, the header toggle, the stored
   preference and the pre-paint script were all removed deliberately: cdot.app
   is the light surface and cdot.world is the dark one, and that contrast is
   the whole distinction between two sites that otherwise share a mark, a
   palette and a typeface pair.

   So this no longer checks that a light block is well formed - it checks that
   one has not come back. Both routes are covered: an explicit
   :root[data-theme="light"] block, and a prefers-color-scheme media query.
   Either would restate the palette in a second place, which is exactly how the
   old duplicate drifted within minutes of being written, silently.

   If a second theme is ever wanted again, this check is the thing to rewrite
   first - with a parity check between the two copies, not without one.
--------------------------------------------------------------------------- */
{
  const tokensPath = "src/styles/tokens.css";
  let css = null;
  try {
    css = readFileSync(resolve(root, tokensPath), "utf8");
  } catch {
    console.log(`  -- ${tokensPath} not readable, dark-only check skipped`);
  }

  if (css) {
    const problems = [];
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

    const lightBlocks = stripped.match(/:root\[data-theme="light"\]\s*\{/g) || [];
    if (lightBlocks.length) {
      problems.push(
        `found ${lightBlocks.length} :root[data-theme="light"] block(s) - the site ` +
        "is dark only. Nothing sets data-theme any more, so this is dead weight " +
        "at best and a second source of truth at worst.",
      );
    }
    if (/@media[^{]*prefers-color-scheme/.test(stripped)) {
      problems.push(
        "a prefers-color-scheme block is back - that restates the palette and " +
        "the two copies drift silently. Add a parity check if this is intended.",
      );
    }

    /* The address-bar colour is a <meta> tag, so it cannot read a custom
       property: Layout.astro hardcodes it. That is the one duplication of
       --bg-0 left in the codebase, and it has drifted before. */
    const layoutPath = "src/layouts/Layout.astro";
    let layout = null;
    try {
      layout = readFileSync(resolve(root, layoutPath), "utf8");
    } catch {
      problems.push(`${layoutPath} not readable, theme-color unchecked`);
    }
    if (layout) {
      const meta = layout.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/);
      const rootBg = stripped.match(/:root\s*\{[\s\S]*?--bg-0\s*:\s*([^;]+);/);
      if (!meta) {
        problems.push(`could not find the theme-color meta tag in ${layoutPath}`);
      } else if (rootBg) {
        const norm = (h) => h.trim().toLowerCase();
        if (norm(meta[1]) !== norm(rootBg[1])) {
          problems.push(
            `theme-color ${meta[1]} != --bg-0 ${rootBg[1].trim()} - the browser ` +
            "chrome will not match the page.",
          );
        }
      }
    }

    if (problems.length) {
      failures++;
      console.log(`  X  dark only  (${tokensPath})`);
      for (const pr of problems) console.log(`     - ${pr}`);
    } else {
      console.log("  OK dark only (no second theme; theme-color matches --bg-0)");
    }
  }
}

console.log("");
if (failures) {
  console.error(`FAIL - ${failures} consumer(s) have drifted from brand/palette.json\n`);
  process.exit(1);
}
console.log(`All consumers agree${skipped ? ` (${skipped} skipped)` : ""}.\n`);
