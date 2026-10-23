/* ---------------------------------------------------------------------------
   The contact form's server side - Cloudflare Pages Function logic.

   Replaces the Google Apps Script (scripts/contact-form.gs) with the same
   behaviour: record the enquiry, email the team, refuse abuse. Lives in a plain
   .mjs module, separate from the route file (functions/api/contact.js), so
   `npm run test:forms` can run it in Node against a real SQLite database - D1 IS
   SQLite - with a stand-in for the email binding.

   WHAT IT NEEDS (all set in the Cloudflare dashboard - see README "Contact form"):
     DB          a D1 database bound to the Pages project   (required)
     EMAIL       a send_email binding                       (optional: without it
                 entries are still saved and flagged notified=0, then retried)
     NOTIFY_TO   who is told about each entry   (default: info@certonymity.com)
     MAIL_FROM   the sender address             (default: forms@cdot.world)
     RETENTION_DAYS  delete entries older than this (unset = keep everything)

   FAILURE POLICY - the point of every branch below:
     - If the message cannot be saved, the visitor is TOLD (503) so they can use
       the email address instead. A form that says "sent" and loses the message
       is the one failure that cannot be allowed.
     - If the message is saved but the notification email fails, the visitor still
       sees success (their message IS safe), the row is flagged notified=0, and the
       next submission retries it. Nothing is silently dropped.
     - The visitor never sees a stack trace or an internal error message.
     - The enquiry itself is never written to logs; only error codes are.
--------------------------------------------------------------------------- */

export const LIMITS = {
  emailMax: 254,
  messageMax: 5000, /* the form's own maxlength */
  bodyMax: 12000, /* the whole request, so a huge POST is refused before parsing */
  perEmailPerHour: 5, /* same as the Apps Script it replaces */
  totalPerHour: 40,
  retryBatch: 3, /* unsent notifications retried per submission */
  maxNotifyAttempts: 5,
};

const HOUR = 3600 * 1000;
const DEFAULT_NOTIFY_TO = "info@certonymity.com";
const DEFAULT_MAIL_FROM = "forms@cdot.world";
const FALLBACK_MESSAGE = "Please email us directly at info@certonymity.com.";

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    /* public/_headers only covers static files, not function responses, so the
       one header that matters for a JSON endpoint is set here. */
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });
const fail = (status, error, headers) => json(status, { ok: false, error }, headers);

/* Control characters (except newline and tab) and the bidirectional overrides,
   which can make text display in a different order than it is written. Built from
   numeric code points so the source itself contains no hidden characters.

   Two regexes on purpose: a /g regex keeps state between .test() calls
   (lastIndex), so the one used to strip must not be the one used to test. */
const UNSAFE_RANGES = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f], [0x202a, 0x202e], [0x2066, 0x2069]];
const UNSAFE_CLASS = UNSAFE_RANGES.map(([lo, hi]) => String.fromCharCode(lo) + (hi > lo ? "-" + String.fromCharCode(hi) : "")).join("");
const STRIP_UNSAFE = new RegExp("[" + UNSAFE_CLASS + "]", "g");
const HAS_UNSAFE = new RegExp("[" + UNSAFE_CLASS + "]");

export const cleanMessage = (s) => s.replace(/\r\n?/g, "\n").replace(STRIP_UNSAFE, "").trim();

const ADDR = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
export function validEmail(s) {
  return (
    typeof s === "string" &&
    s.length <= LIMITS.emailMax &&
    s.indexOf("@") <= 64 &&
    ADDR.test(s) &&
    !HAS_UNSAFE.test(s)
  );
}

export function buildNotification(entry, env) {
  return {
    to: env.NOTIFY_TO || DEFAULT_NOTIFY_TO,
    from: env.MAIL_FROM || DEFAULT_MAIL_FROM,
    /* The visitor's address, so "Reply" in the inbox answers them. */
    replyTo: entry.email,
    /* entry.email has been validated: no whitespace, so no header injection. */
    subject: `cDot contact form enquiry from ${entry.email}`,
    text: [
      "New enquiry from the cDot website contact form.",
      "",
      `From:     ${entry.email}`,
      `Received: ${entry.created_at}`,
      `Entry:    ${entry.id}`,
      "",
      entry.message,
      "",
      "--",
      "Reply to this email to answer them directly.",
    ].join("\n"),
  };
}

/* Resolves { ok } and never throws. */
export async function notify(env, entry) {
  if (!env.EMAIL || typeof env.EMAIL.send !== "function") return { ok: false, reason: "no-email-binding" };
  try {
    await env.EMAIL.send(buildNotification(entry, env));
    return { ok: true };
  } catch (e) {
    /* The error code only: the message could echo the visitor's address. */
    console.error("contact: notification failed", (e && e.code) || "unknown");
    return { ok: false, reason: (e && e.code) || "error" };
  }
}

async function recordNotification(db, id, ok) {
  await db
    .prepare("UPDATE contact_entries SET notified = ?1, notify_attempts = notify_attempts + 1 WHERE id = ?2")
    .bind(ok ? 1 : 0, id)
    .run();
}

/* Entries saved earlier whose email failed: try a few again. Bounded, so one bad
   moment cannot turn into an unbounded burst. */
async function retryPending(env, currentId, now) {
  if (!env.EMAIL) return;
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, email, message FROM contact_entries " +
      "WHERE notified = 0 AND notify_attempts < ?1 AND id <> ?2 AND created_at < ?3 " +
      "ORDER BY created_at LIMIT ?4",
  )
    .bind(LIMITS.maxNotifyAttempts, currentId, new Date(now - 60 * 1000).toISOString(), LIMITS.retryBatch)
    .all();
  for (const row of results || []) {
    const r = await notify(env, row);
    await recordNotification(env.DB, row.id, r.ok);
  }
}

/* Entries older than RETENTION_DAYS are deleted as submissions arrive (a Pages
   Function has no scheduler). Off unless RETENTION_DAYS is set to 30 or more, so
   nothing is ever deleted by accident. */
async function purgeExpired(env, now) {
  const days = Number(env.RETENTION_DAYS);
  if (!Number.isFinite(days) || days < 30) return;
  await env.DB.prepare("DELETE FROM contact_entries WHERE created_at < ?1")
    .bind(new Date(now - days * 24 * HOUR).toISOString())
    .run();
}

/**
 * @param {Request} request
 * @param {{ DB?: any, EMAIL?: any, NOTIFY_TO?: string, MAIL_FROM?: string, RETENTION_DAYS?: string }} env
 * @param {number} [now] injectable clock, for tests
 */
export async function handleContact(request, env, now = Date.now()) {
  try {
    if (request.method !== "POST") return fail(405, "Method not allowed.", { allow: "POST" });

    /* Same-origin only: the form is on this site, so a request claiming to come
       from anywhere else is not it. (A missing Origin is allowed: some browsers
       omit it on same-origin POSTs, and non-browser clients gain nothing.) */
    const origin = request.headers.get("origin");
    if (origin) {
      let same = false;
      try { same = new URL(origin).host === new URL(request.url).host; } catch { /* malformed */ }
      if (!same) return fail(403, "Forbidden.");
    }

    if (Number(request.headers.get("content-length") || 0) > LIMITS.bodyMax) return fail(413, "That message is too long.");
    const raw = await request.text();
    if (raw.length > LIMITS.bodyMax) return fail(413, "That message is too long.");

    /* The form posts with no Content-Type (so it is text/plain), as it did to
       Apps Script; the body is JSON either way, so parse it whatever it claims. */
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, "That did not look like a valid message."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "That did not look like a valid message.");

    /* Honeypot: a field people never see and bots fill in. Say "sent" and store
       nothing, so the bot learns nothing. */
    if (typeof body.website === "string" && body.website.trim() !== "") return json(200, { ok: true });

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? cleanMessage(body.message) : "";
    if (!validEmail(email)) return fail(400, "Please enter a valid email address.");
    if (!message) return fail(400, "Please enter a message.");
    if (message.length > LIMITS.messageMax) return fail(400, `Please keep your message under ${LIMITS.messageMax} characters.`);

    if (!env || !env.DB) {
      console.error("contact: no D1 binding named DB");
      return fail(503, `This form is not available right now. ${FALLBACK_MESSAGE}`);
    }

    const since = new Date(now - HOUR).toISOString();
    const [perEmail, total] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM contact_entries WHERE lower(email) = ?1 AND created_at > ?2")
        .bind(email.toLowerCase(), since).first("n"),
      env.DB.prepare("SELECT COUNT(*) AS n FROM contact_entries WHERE created_at > ?1").bind(since).first("n"),
    ]);
    if (perEmail >= LIMITS.perEmailPerHour) return fail(429, "You've sent several messages recently. Please try again later.", { "retry-after": "3600" });
    if (total >= LIMITS.totalPerHour) return fail(429, "We're receiving a lot of messages right now. Please try again shortly.", { "retry-after": "600" });

    const entry = { id: crypto.randomUUID(), created_at: new Date(now).toISOString(), email, message };
    await env.DB.prepare("INSERT INTO contact_entries (id, created_at, email, message) VALUES (?1, ?2, ?3, ?4)")
      .bind(entry.id, entry.created_at, entry.email, entry.message)
      .run();

    /* Saved. From here on the visitor sees success whatever happens. */
    try {
      const sent = await notify(env, entry);
      await recordNotification(env.DB, entry.id, sent.ok);
      await retryPending(env, entry.id, now);
      await purgeExpired(env, now);
    } catch (e) {
      console.error("contact: follow-up failed", (e && e.message) || "unknown");
    }
    return json(200, { ok: true });
  } catch (e) {
    console.error("contact: unexpected error", (e && e.message) || "unknown");
    return fail(500, `Something went wrong. ${FALLBACK_MESSAGE}`);
  }
}
