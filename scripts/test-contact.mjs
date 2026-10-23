/* ---------------------------------------------------------------------------
   `npm run test:forms` - tests for the contact form's server side
   (functions/_lib/contact.mjs).

   D1 is SQLite, so the tests run the REAL handler against a REAL in-memory SQLite
   database (Node's built-in node:sqlite), using the migration file as the schema.
   Only two things are faked: the email binding (a recorder that can be told to
   fail) and the clock (so "an hour later" does not take an hour).
--------------------------------------------------------------------------- */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleContact, validEmail, cleanMessage, buildNotification, LIMITS } from "../functions/_lib/contact.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCHEMA = readFileSync(resolve(root, "migrations/0001_contact_entries.sql"), "utf8");
const T0 = Date.parse("2026-11-01T12:00:00Z");

/* The slice of the D1 API the handler uses, over node:sqlite. */
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  const api = {
    raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const make = (args) => ({
        bind: (...a) => make(a),
        run: async () => ({ success: true, meta: { changes: stmt.run(...args).changes } }),
        first: async (col) => { const r = stmt.get(...args); return r === undefined ? null : col ? r[col] : r; },
        all: async () => ({ results: stmt.all(...args) }),
      });
      return make([]);
    },
  };
  return api;
}

function mailer({ failFirst = 0 } = {}) {
  const m = { sent: [], calls: 0, async send(msg) { m.calls += 1; if (m.calls <= failFirst) { const e = new Error("boom: secret@example.com"); e.code = "E_DELIVERY_FAILED"; throw e; } m.sent.push(msg); return { messageId: "m" + m.calls }; } };
  return m;
}

const post = (body, { headers = {}, url = "https://cdot.world/api/contact", raw } = {}) =>
  new Request(url, { method: "POST", headers, body: raw ?? JSON.stringify(body) });
const good = (over = {}) => ({ email: "ada@example.com", message: "Hello there", website: "", ...over });
const rows = (db) => db.raw.prepare("SELECT * FROM contact_entries ORDER BY created_at").all();
const run = async (req, env, now = T0) => { const res = await handleContact(req, env, now); return { res, body: await res.json() }; };

test("a valid submission is saved, emailed to the team with the visitor as reply-to, and marked notified", async () => {
  const db = d1(), EMAIL = mailer();
  const { res, body } = await run(post(good()), { DB: db, EMAIL });
  assert.equal(res.status, 200); assert.deepEqual(body, { ok: true });
  const [row] = rows(db);
  assert.equal(row.email, "ada@example.com"); assert.equal(row.message, "Hello there");
  assert.equal(row.notified, 1); assert.equal(row.notify_attempts, 1); assert.equal(row.source, "web");
  assert.equal(row.created_at, new Date(T0).toISOString());
  assert.equal(EMAIL.sent.length, 1);
  const m = EMAIL.sent[0];
  assert.equal(m.to, "info@certonymity.com"); assert.equal(m.from, "forms@cdot.world");
  assert.equal(m.replyTo, "ada@example.com");
  assert.equal(m.subject, "cDot contact form enquiry from ada@example.com");
  assert.match(m.text, /Hello there/);
});

test("NOTIFY_TO and MAIL_FROM can be configured", async () => {
  const EMAIL = mailer();
  await run(post(good()), { DB: d1(), EMAIL, NOTIFY_TO: "support@certonymity.com", MAIL_FROM: "forms@cdot.app" });
  assert.equal(EMAIL.sent[0].to, "support@certonymity.com"); assert.equal(EMAIL.sent[0].from, "forms@cdot.app");
});

test("the body is parsed as JSON whatever Content-Type it claims (the form sends none)", async () => {
  for (const headers of [{}, { "content-type": "text/plain;charset=UTF-8" }, { "content-type": "application/json" }]) {
    const { res } = await run(post(good(), { headers }), { DB: d1(), EMAIL: mailer() });
    assert.equal(res.status, 200);
  }
});

test("honeypot: reports success to the bot but stores and sends nothing", async () => {
  const db = d1(), EMAIL = mailer();
  const { res, body } = await run(post(good({ website: "http://spam.example" })), { DB: db, EMAIL });
  assert.equal(res.status, 200); assert.deepEqual(body, { ok: true });
  assert.equal(rows(db).length, 0); assert.equal(EMAIL.sent.length, 0);
});

test("validation: bad or hostile emails are refused", async () => {
  for (const email of ["", "nope", "a@b", "a b@c.com", "a@b.com\nBcc: evil@x.com", "a@b.com\r\nSubject: x", "<x>@y.com", "a@b.com,c@d.com", "x".repeat(250) + "@y.com", "a".repeat(65) + "@y.com"]) {
    const db = d1();
    const { res, body } = await run(post(good({ email })), { DB: db, EMAIL: mailer() });
    assert.equal(res.status, 400, JSON.stringify(email)); assert.equal(body.ok, false);
    assert.equal(rows(db).length, 0);
  }
  assert.equal((await run(post({ email: 5, message: "x" }), { DB: d1() })).res.status, 400);
});

test("validEmail gives the same answer every time (no leftover regex state)", () => {
  for (let i = 0; i < 6; i++) assert.equal(validEmail("ada@example.com"), true);
  for (let i = 0; i < 6; i++) assert.equal(validEmail("a@b.com‮"), false);
});

test("validation: empty and over-long messages are refused; the limit is inclusive", async () => {
  assert.equal((await run(post(good({ message: "   \n " })), { DB: d1() })).res.status, 400);
  assert.equal((await run(post(good({ message: "x".repeat(LIMITS.messageMax + 1) })), { DB: d1() })).res.status, 400);
  assert.equal((await run(post(good({ message: "x".repeat(LIMITS.messageMax) })), { DB: d1(), EMAIL: mailer() })).res.status, 200);
});

test("messages are cleaned: control characters and bidi overrides removed, newlines kept", async () => {
  assert.equal(cleanMessage("a\u0000b\u0007c\r\nd‮e⁦f"), "abc\ndef");
  const db = d1();
  await run(post(good({ message: "line1\r\nline2\u0000‮" })), { DB: db, EMAIL: mailer() });
  assert.equal(rows(db)[0].message, "line1\nline2");
});

test("a visitor-controlled message cannot inject email headers", () => {
  const n = buildNotification({ id: "1", created_at: "t", email: "ada@example.com", message: "x\nBcc: evil@x.com" }, {});
  assert.equal(n.subject.includes("\n"), false);
  assert.equal(n.to, "info@certonymity.com");
});

test("SQL in a message is stored as text, never executed", async () => {
  const db = d1();
  await run(post(good({ message: "'); DROP TABLE contact_entries; --" })), { DB: db, EMAIL: mailer() });
  assert.equal(rows(db).length, 1);
  assert.match(rows(db)[0].message, /DROP TABLE/);
});

test("rate limit: at most 5 per email per hour (case-insensitive), then it frees up", async () => {
  const db = d1(), env = { DB: db, EMAIL: mailer() };
  for (let i = 0; i < LIMITS.perEmailPerHour; i++) assert.equal((await run(post(good({ email: i % 2 ? "ADA@example.com" : "ada@example.com" })), env, T0 + i)).res.status, 200);
  const blocked = await run(post(good()), env, T0 + 10);
  assert.equal(blocked.res.status, 429); assert.equal(blocked.res.headers.get("retry-after"), "3600");
  assert.equal((await run(post(good({ email: "other@example.com" })), env, T0 + 11)).res.status, 200);
  assert.equal((await run(post(good()), env, T0 + 61 * 60 * 1000)).res.status, 200);
});

test("rate limit: at most 40 in total per hour", async () => {
  const db = d1(), env = { DB: db, EMAIL: mailer() };
  for (let i = 0; i < LIMITS.totalPerHour; i++) assert.equal((await run(post(good({ email: `u${i}@example.com` })), env, T0 + i)).res.status, 200);
  const blocked = await run(post(good({ email: "late@example.com" })), env, T0 + 100);
  assert.equal(blocked.res.status, 429); assert.equal(blocked.res.headers.get("retry-after"), "600");
});

test("requests are refused: wrong method, other origin, oversized body, bad JSON", async () => {
  const env = { DB: d1(), EMAIL: mailer() };
  const get = await run(new Request("https://cdot.world/api/contact"), env);
  assert.equal(get.res.status, 405); assert.equal(get.res.headers.get("allow"), "POST");
  assert.equal((await run(post(good(), { headers: { origin: "https://evil.example" } }), env)).res.status, 403);
  assert.equal((await run(post(good(), { headers: { origin: "https://cdot.world" } }), env)).res.status, 200);
  assert.equal((await run(post(good(), { headers: { origin: "not a url" } }), env)).res.status, 403);
  assert.equal((await run(post(null, { raw: "x".repeat(LIMITS.bodyMax + 1) }), env)).res.status, 413);
  for (const raw of ["", "{", "null", "[]", '"str"']) assert.equal((await run(post(null, { raw }), env)).res.status, 400, raw);
});

test("preview deployments work: the origin check compares against the request's own host", async () => {
  const { res } = await run(post(good(), { url: "https://astro-port.cdot-world.pages.dev/api/contact", headers: { origin: "https://astro-port.cdot-world.pages.dev" } }), { DB: d1(), EMAIL: mailer() });
  assert.equal(res.status, 200);
});

test("with no database bound, the visitor is TOLD (503) and pointed at the email address", async () => {
  const { res, body } = await run(post(good()), { EMAIL: mailer() });
  assert.equal(res.status, 503); assert.equal(body.ok, false);
  assert.match(body.error, /info@certonymity\.com/);
});

test("if the email fails the entry is still saved, the visitor sees success, and the row is flagged", async () => {
  const db = d1(), EMAIL = mailer({ failFirst: 1 });
  const { res, body } = await run(post(good()), { DB: db, EMAIL });
  assert.equal(res.status, 200); assert.deepEqual(body, { ok: true });
  assert.equal(rows(db)[0].notified, 0); assert.equal(rows(db)[0].notify_attempts, 1);
});

test("the failed notification is retried by a later submission, and the error never reaches the visitor", async () => {
  const db = d1(), EMAIL = mailer({ failFirst: 1 });
  const first = await run(post(good({ message: "first" })), { DB: db, EMAIL }, T0);
  assert.equal(JSON.stringify(first.body).includes("secret@example.com"), false);
  await run(post(good({ email: "grace@example.com", message: "second" })), { DB: db, EMAIL }, T0 + 5 * 60 * 1000);
  const all = rows(db);
  assert.deepEqual(all.map((r) => r.notified), [1, 1]);
  assert.equal(EMAIL.sent.length, 2);
  assert.ok(EMAIL.sent.some((m) => /first/.test(m.text)));
});

test("a notification that keeps failing stops being retried after the maximum attempts", async () => {
  const db = d1(), EMAIL = mailer({ failFirst: 1000 });
  await run(post(good()), { DB: db, EMAIL }, T0);
  for (let i = 1; i <= 8; i++) await run(post(good({ email: `u${i}@example.com` })), { DB: db, EMAIL }, T0 + i * 120000);
  const first = rows(db).find((r) => r.email === "ada@example.com");
  assert.equal(first.notify_attempts, LIMITS.maxNotifyAttempts);
});

test("without an email binding entries are still saved and wait, flagged, to be notified", async () => {
  const db = d1();
  const { res } = await run(post(good()), { DB: db });
  assert.equal(res.status, 200);
  assert.equal(rows(db)[0].notified, 0);
});

test("retention: nothing is deleted unless RETENTION_DAYS is set to 30 or more", async () => {
  const db = d1();
  db.raw.prepare("INSERT INTO contact_entries (id, created_at, email, message) VALUES ('old', ?1, 'old@example.com', 'old')").run(new Date(T0 - 400 * 86400000).toISOString());
  await run(post(good()), { DB: db, EMAIL: mailer() });
  assert.equal(rows(db).length, 2);
  await run(post(good({ email: "b@example.com" })), { DB: db, EMAIL: mailer(), RETENTION_DAYS: "5" });
  assert.equal(rows(db).length, 3);
  await run(post(good({ email: "c@example.com" })), { DB: db, EMAIL: mailer(), RETENTION_DAYS: "365" });
  assert.equal(rows(db).some((r) => r.id === "old"), false);
  assert.equal(rows(db).length, 3);
});

test("an unexpected database error gives a generic 500, with no internals in the response", async () => {
  const broken = { prepare() { throw new Error("SQLITE_CORRUPT at /secret/path"); } };
  const { res, body } = await run(post(good()), { DB: broken, EMAIL: mailer() });
  assert.equal(res.status, 500);
  assert.equal(JSON.stringify(body).includes("SQLITE"), false); assert.equal(JSON.stringify(body).includes("/secret"), false);
});

test("every response is JSON and not cacheable", async () => {
  const env = { DB: d1(), EMAIL: mailer() };
  for (const { res } of [await run(post(good()), env), await run(post(good({ email: "x" })), env), await run(post(null, { raw: "{" }), env)]) {
    assert.match(res.headers.get("content-type"), /application\/json/);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  }
});
