/* ---------------------------------------------------------------------------
   Where the contact form posts - the switch between Google and Cloudflare.

   "google"      the Apps Script web app (scripts/contact-form.gs). The default,
                 and what is live today.
   "cloudflare"  this site's own /api/contact (functions/api/contact.js), which
                 stores entries in a D1 database and emails the team. Needs the
                 setup in README.md "Contact form (Cloudflare)" first - until the
                 database is bound, that endpoint answers 503 and the form tells
                 the visitor to email instead.

   TO TRY IT WITHOUT SWITCHING EVERYONE: set CONTACT_BACKEND=cloudflare as a Pages
   variable on the Preview environment only. Every preview deployment then posts
   to Cloudflare while production still posts to Google. (Locally, it is an
   environment variable for the build or dev server.)

   The environment variable wins over the constant in either direction, like
   BLOG_LIVE in blog.mjs.
--------------------------------------------------------------------------- */

export const CONTACT_BACKEND_DEFAULT = "google";

const env = (k) => (typeof process !== "undefined" ? process.env[k] : undefined);

export const contactBackend = env("CONTACT_BACKEND") || CONTACT_BACKEND_DEFAULT;
if (!["google", "cloudflare"].includes(contactBackend)) {
  throw new Error(`CONTACT_BACKEND must be "google" or "cloudflare", not "${contactBackend}".`);
}

/* Public by design - it only ever appends a row (see scripts/contact-form.gs). */
export const GOOGLE_CONTACT_URL =
  "https://script.google.com/macros/s/AKfycbzkT4I_iMLiBBKRZeKdSEU2ohJVpfOFd4UA-tk2ss4p2YddFDbvU1OFPnjHcr0RaOHdUA/exec";

export const CLOUDFLARE_CONTACT_PATH = "/api/contact";

export const contactEndpoint = contactBackend === "cloudflare" ? CLOUDFLARE_CONTACT_PATH : GOOGLE_CONTACT_URL;
