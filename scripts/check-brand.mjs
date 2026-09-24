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
   Single light block.

   Dark is unconditional and light is opt-in via :root[data-theme="light"], so
   the palette is stated ONCE. It used to be stated twice - the second copy
   existed only to serve prefers-color-scheme - and the two drifted within
   minutes of being written with nothing to catch it: the OS path and the toggle
   path simply rendered different colours.

   Re-adding a prefers-color-scheme block would reintroduce that, so this fails
   if one appears. If following the OS is ever wanted again, the duplication has
   to come back with a parity check alongside it.
--------------------------------------------------------------------------- */
{
  const tokensPath = "src/styles/tokens.css";
  let css = null;
  try {
    css = readFileSync(resolve(root, tokensPath), "utf8");
  } catch {
    console.log(`  -- ${tokensPath} not readable, light-theme check skipped`);
  }

  if (css) {
    const problems = [];
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

    const lightBlocks = stripped.match(/:root\[data-theme="light"\]\s*\{/g) || [];
    if (lightBlocks.length !== 1) {
      problems.push(`expected exactly 1 :root[data-theme="light"] block, found ${lightBlocks.length}`);
    }
    if (/@media[^{]*prefers-color-scheme/.test(stripped)) {
      problems.push(
        "a prefers-color-scheme block is back - that restates the palette and " +
        "the two copies drift silently. Add a parity check if this is intended.",
      );
    }

    /* The address-bar colour is a <meta> tag, so it cannot read a custom
       property: Layout.astro hardcodes both backgrounds. That duplication has
       already drifted once - the light constant kept an older --bg-0 after the
       palette was realigned, leaving the browser chrome a different white from
       the page. */
    const layoutPath = "src/layouts/Layout.astro";
    let layout = null;
    try {
      layout = readFileSync(resolve(root, layoutPath), "utf8");
    } catch {
      problems.push(`${layoutPath} not readable, theme-color constants unchecked`);
    }
    if (layout) {
      const consts = layout.match(
        /var DARK_BG\s*=\s*'([^']+)'\s*,\s*LIGHT_BG\s*=\s*'([^']+)'/,
      );
      const rootBg = stripped.match(/:root\s*\{[\s\S]*?--bg-0\s*:\s*([^;]+);/);
      const lightBg = stripped.match(
        /:root\[data-theme="light"\]\s*\{[\s\S]*?--bg-0\s*:\s*([^;]+);/,
      );
      if (!consts) {
        problems.push(`could not find DARK_BG/LIGHT_BG in ${layoutPath}`);
      } else if (rootBg && lightBg) {
        const norm = (h) => h.trim().toLowerCase();
        if (norm(consts[1]) !== norm(rootBg[1])) {
          problems.push(`DARK_BG ${consts[1]} != dark --bg-0 ${rootBg[1].trim()}`);
        }
        if (norm(consts[2]) !== norm(lightBg[1])) {
          problems.push(`LIGHT_BG ${consts[2]} != light --bg-0 ${lightBg[1].trim()}`);
        }
      }
    }

    if (problems.length) {
      failures++;
      console.log(`  X  light theme  (${tokensPath})`);
      for (const pr of problems) console.log(`     - ${pr}`);
    } else {
      console.log("  OK light theme (single opt-in block; theme-color matches --bg-0)");
    }
  }
}

console.log("");
if (failures) {
  console.error(`FAIL - ${failures} consumer(s) have drifted from brand/palette.json\n`);
  process.exit(1);
}
console.log(`All consumers agree${skipped ? ` (${skipped} skipped)` : ""}.\n`);
