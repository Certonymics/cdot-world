/* ---------------------------------------------------------------------------
   Writes the Content-Security-Policy into dist/_headers.

   Runs after `astro build` (see the "build" script in package.json).

   WHY THIS IS A BUILD STEP AND NOT JUST A LINE IN public/_headers
   The page has inline <script> blocks (the mobile menu, the forms). A strict
   policy cannot allow "any inline script" - that is the very thing it exists to
   stop - so each one is allowed by its SHA-256 hash instead. The browser hashes
   the script it finds and runs it only if the hash is on the list. The hash
   changes whenever the script's text does, so it cannot be written by hand: this
   script reads the built HTML, hashes what is really there, and writes the list.
   Edit an inline script, rebuild, and the policy follows.

   WHAT IT REFUSES TO BUILD
   It fails the build, loudly, if it finds anything the policy would block at
   runtime - an inline style="" attribute, an inline event handler (onclick=...),
   a <style> block, or a script loaded from another origin. A silently broken form
   in production is far worse than a failed build, and each of those is a one-line
   fix when it is caught here.

   THE OUTSIDE ORIGINS (CONNECT_ORIGINS) are the places the page's own JavaScript
   talks to. If map.js or a form starts calling somewhere new, add it here, or the
   browser will refuse the request.
--------------------------------------------------------------------------- */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist");

/* Where fetch() is allowed to go, besides this site.
   - script.google.com is the Apps Script endpoint both forms POST to.
   - script.googleusercontent.com is where Google then REDIRECTS the response: a
     connect-src check applies to every hop of a redirect, so omitting it would
     make every submission fail even though the first request was allowed.
   - map.c-layer.certonym.org is the node registry the map reads. */
const CONNECT_ORIGINS = [
  "https://script.google.com",
  "https://script.googleusercontent.com",
  "https://map.c-layer.certonym.org",
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const htmlFiles = walk(dist).filter((f) => f.endsWith(".html"));
if (!htmlFiles.length) {
  console.error("build-headers: no HTML found in dist/. Run `astro build` first.");
  process.exit(1);
}

const hashes = new Set();
const problems = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(dist.length + 1);

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    const body = m[2];
    if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue; // data, never executed
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (src) {
      if (!src[1].startsWith("/")) problems.push(`${rel}: script loaded from another origin: ${src[1]}`);
      continue; // same-origin files are covered by 'self'
    }
    if (body.trim()) hashes.add("sha256-" + createHash("sha256").update(body, "utf8").digest("base64"));
  }

  if (/<style\b/i.test(html)) problems.push(`${rel}: contains a <style> block (move it into global.css)`);
  if (/\sstyle\s*=\s*["']/i.test(html)) problems.push(`${rel}: contains an inline style="" attribute (use a class)`);
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) problems.push(`${rel}: contains an inline event handler such as onclick= (use addEventListener)`);
}

if (problems.length) {
  console.error("build-headers: the Content-Security-Policy would block these at runtime:\n");
  for (const p of problems) console.error("  - " + p);
  console.error("\nFix them, or the browser will silently refuse them in production.");
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().map((h) => `'${h}'`).join(" ")}`.trim(),
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  `connect-src 'self' ${CONNECT_ORIGINS.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const headersPath = join(dist, "_headers");
let headers;
try {
  headers = readFileSync(headersPath, "utf8");
} catch {
  console.error("build-headers: dist/_headers is missing - is public/_headers still there?");
  process.exit(1);
}
if (!headers.includes("__CSP__")) {
  console.error("build-headers: no __CSP__ placeholder in dist/_headers to replace.");
  process.exit(1);
}

writeFileSync(headersPath, headers.replace("__CSP__", csp));
console.log(
  `build-headers: wrote Content-Security-Policy to dist/_headers ` +
  `(${hashes.size} inline script hash${hashes.size === 1 ? "" : "es"} across ${htmlFiles.length} page${htmlFiles.length === 1 ? "" : "s"}).`,
);
