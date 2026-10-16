/* Date of the last commit that touched the site's content - what the WebPage's
   dateModified and the sitemap's <lastmod> both say, so they cannot disagree.

   Not the build time: a build-time stamp would claim the page changed on every
   deploy, which is the one thing a freshness signal must not do. Scoped to src/
   and public/ so a lockfile bump does not count. Falls back to the build time
   only if git is unavailable (a tarball build, say), where there is nothing
   better to say. */
import { execSync } from "node:child_process";

export function lastModified() {
  try {
    const d = execSync("git log -1 --format=%cI -- src public", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (d) return d;
  } catch {}
  return new Date().toISOString();
}
