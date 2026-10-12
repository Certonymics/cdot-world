/**
 * cDot - contact form capture (cdot.world).
 *
 * Not part of the site build. This file is the source of the Google Apps Script
 * that receives contact enquiries straight from the browser (see the contact
 * form script in the cdot-world repo, src/pages/index.astro), appends them to a
 * spreadsheet, and emails the team. It is kept in the repo so the script is
 * versioned alongside the form it serves.
 *
 * This is a SEPARATE deployment from the c.Email / cdot.app contact form
 * (c.email-website/scripts/contact-form.gs), with its own script and its own
 * spreadsheet. They deliberately share no infrastructure: editing one cannot
 * break the other, and these enquiries never mix into that sheet.
 *
 * The /exec URL is public: it ships in the page source. That is deliberate.
 * This script only ever appends a row and has no doGet, so holding the URL grants
 * no way to read the sheet. What it does allow is anyone submitting, so every
 * value is treated as hostile: see plain() and the rate limits.
 *
 * Setup (do this on the Certonymity Workspace account, not a personal Gmail -
 * Workspace includes a data processing agreement, consumer Gmail does not. This
 * form collects free-text message bodies, not just an address):
 *
 *   1. Create a Google Sheet named "cDot contact enquiries".
 *   2. Extensions > Apps Script. Paste this file over the default Code.gs.
 *   3. Run setUpSheet once, then testEmail once (grants the mail scope).
 *   4. Deploy > New deployment > type "Web app".
 *        Execute as:        Me
 *        Who has access:    Anyone
 *      "Anyone" makes the URL callable without a Google login. It does not make
 *      the spreadsheet readable - this script only ever appends.
 *   5. Copy the /exec URL into CONTACT_FORM_URL in the site's contact form.
 *
 * Re-deploy after editing (Deploy > Manage deployments > New version), or the
 * live endpoint keeps running the old version. Never use "New deployment" for an
 * edit: it creates a new URL and the site would stop working.
 */

const SHEET_NAME = 'Enquiries'

// Where enquiries are emailed. The form has no enquiry-type selector, so there
// is nothing to route on - one destination, declared once.
const NOTIFY_TO = 'info@certonymity.com'

// Copied on every enquiry. The script runs as the account that owns it, so the
// email is SENT by that account. info@ is a group the owner belongs to, and
// Gmail does not deliver the sender's own group mail to their Inbox - it only
// lands in Sent. Copying the owner directly gets a copy into the Inbox.
//
// The address is a SCRIPT PROPERTY, not a constant, because this file is
// committed to a public repository and a person's address does not belong in
// one. Set it in the Apps Script editor: Project Settings > Script properties >
// Add script property, name CC_ADDRESS, value the address to copy. If it is not
// set, no copy is sent - and the owner's Inbox goes back to receiving nothing,
// which is easy to miss, so testEmail() reports it.
function ccAddress() {
  return PropertiesService.getScriptProperties().getProperty('CC_ADDRESS') || ''
}

// Long enough for a real enquiry, short enough that the sheet cell stays usable
// and a bot can't dump megabytes into it. Apps Script caps a cell at 50k chars.
// Keep in sync with the maxlength on the textarea in the site's contact form.
const MAX_MESSAGE_LENGTH = 5000

// Longest valid email address.
const MAX_EMAIL_LENGTH = 254

// A real submission is a few hundred bytes plus the message. Anything much
// bigger than the limits above allow is not from the form.
const MAX_REQUEST_LENGTH = 30000

// Flood protection. Each notification spends the daily mail quota, and a bot
// that exhausts it stops every real enquiry from being emailed. Counted per
// clock hour, so a quiet hour always starts clean. Generous for real use: five
// from one address and forty in total in an hour.
const MAX_PER_EMAIL_PER_HOUR = 5
const MAX_TOTAL_PER_HOUR = 40

const HEADERS = ['Timestamp', 'Email', 'Message', 'Notified']

// Must stay empty. The form calls this script directly from the browser, so any
// value here would ship to the client alongside it - a secret everyone can read
// is not a secret. The honeypot below is what filters bots.
const SHARED_SECRET = ''

// Sheets reads anything typed into a cell as if a person typed it, so a value
// that starts with "=" becomes a formula - and a formula like IMPORTXML can send
// the rest of the sheet to an attacker's server. A leading apostrophe makes the
// cell plain text. Every visitor-supplied value goes through this before it is
// written.
function plain(value) {
  const s = String(value)
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : ''
    if (raw.length > MAX_REQUEST_LENGTH) {
      return reply({ ok: false, error: 'That message is too long. Please shorten it, or email us directly.' })
    }

    const body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply({ ok: false, error: 'server error' })
    }

    if (SHARED_SECRET && body.secret !== SHARED_SECRET) {
      console.warn('Rejected enquiry with bad secret')
      return reply({ ok: false, error: 'unauthorised' })
    }

    // Honeypot. A real browser leaves the hidden field empty; bots fill in
    // everything they find. Accept silently so they get no signal to adapt.
    if (body.website) {
      return reply({ ok: true })
    }

    const email = String(body.email || '').trim()
    if (!email || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ ok: false, error: 'Please enter a valid email address.' })
    }

    const message = String(body.message || '').trim()
    if (!message) {
      return reply({ ok: false, error: 'Please enter a message.' })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return reply({ ok: false, error: 'That message is too long. Please shorten it, or email us directly.' })
    }

    const sheet = getSheet()

    // The limit check and the write share one lock, so two submissions arriving
    // together cannot both slip under the limit, and the row number we get back
    // is ours. If the lock cannot be had in 10s the enquiry is still recorded -
    // losing a real message is worse than skipping a limit once.
    const lock = LockService.getScriptLock()
    const locked = lock.tryLock(10000)
    let row = null
    try {
      if (locked && overLimit(email)) {
        return reply({ ok: false, error: 'Too many messages just now. Please try again later, or email us directly.' })
      }
      // The row is the record of the enquiry, so write it before attempting mail.
      sheet.appendRow([new Date(), plain(email), plain(message), 'Sending'])
      if (locked) row = sheet.getLastRow()
    } finally {
      if (locked) lock.releaseLock()
    }

    // The row is the enquiry; the email is how anyone finds out about it. A
    // silent notification failure means a person believes they contacted us and
    // nobody ever replies - so surface it and ask them to email directly, even
    // though we did save their message. Either way the Notified column records
    // what happened, so a missing email is visible in the sheet.
    try {
      notify(email, message)
    } catch (err) {
      console.error('Enquiry recorded but notification failed:', err)
      setNotified(sheet, row, 'EMAIL FAILED')
      return reply({ ok: false, error: 'We saved your message but could not alert the team. Please email us directly so nothing is missed.' })
    }

    setNotified(sheet, row, 'Emailed')
    return reply({ ok: true })
  } catch (err) {
    console.error(err)
    return reply({ ok: false, error: 'server error' })
  }
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = spreadsheet.getSheetByName(SHEET_NAME)
  if (!sheet) {
    // Reuse the default "Sheet1" if it is still untouched rather than leaving an
    // empty stray tab beside the real one.
    const existing = spreadsheet.getSheets()
    sheet = (existing.length === 1 && existing[0].getLastRow() === 0)
      ? existing[0].setName(SHEET_NAME)
      : spreadsheet.insertSheet(SHEET_NAME)
  }
  // Headers are keyed off the sheet being empty, not off having just created it.
  // Otherwise a tab that already exists - because it was renamed by hand, or had
  // its rows cleared - silently collects unlabelled columns forever.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS)
    sheet.setFrozenRows(1)
  } else if (sheet.getRange(1, 1).getValue() === HEADERS[0] && sheet.getRange(1, 4).getValue() === '') {
    // A sheet from before the Notified column existed: add its heading.
    sheet.getRange(1, 4).setValue(HEADERS[3])
  }
  return sheet
}

// True if this submission would go over a limit; otherwise counts it and returns
// false. Must be called while holding the script lock. The address is hashed so
// it makes a short, safe cache key and no address is kept in the cache.
function overLimit(email) {
  const cache = CacheService.getScriptCache()
  const hour = Math.floor(Date.now() / 3600000)
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email.toLowerCase())
  const totalKey = 't:' + hour
  const emailKey = 'e:' + hour + ':' + Utilities.base64EncodeWebSafe(digest)
  const total = Number(cache.get(totalKey) || 0)
  const mine = Number(cache.get(emailKey) || 0)
  if (total >= MAX_TOTAL_PER_HOUR || mine >= MAX_PER_EMAIL_PER_HOUR) return true
  cache.put(totalKey, String(total + 1), 7200)
  cache.put(emailKey, String(mine + 1), 7200)
  return false
}

function setNotified(sheet, row, status) {
  if (!row) return
  try {
    sheet.getRange(row, 4).setValue(status)
  } catch (err) {
    console.error('Could not record notification status:', err)
  }
}

function notify(email, message) {
  const options = {
    to: NOTIFY_TO,
    subject: 'cDot contact form enquiry from ' + email,
    // Lets whoever picks this up hit reply and reach the sender directly, which
    // is the one real advantage a plain mailto: link has over a form.
    replyTo: email,
    body: [
      'From:  ' + email,
      'Site:  cdot.world',
      '',
      message,
      '',
      '-',
      'Logged in ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    ].join('\n'),
  }
  // Only set when configured: an empty cc is not something to hand to MailApp.
  // Assigned rather than spread, so this does not depend on the V8 runtime.
  const cc = ccAddress()
  if (cc) options.cc = cc
  MailApp.sendEmail(options)
}

/**
 * Setup helper. Not called by doPost - select it in the Apps Script editor's
 * function dropdown and press Run.
 *
 * Creates the Enquiries tab and its header row without sending any mail, so the
 * sheet is visibly ready before the first real enquiry arrives. Until something
 * submits successfully the spreadsheet stays empty, which reads as a broken form
 * even though nothing is wrong - this removes that ambiguity.
 */
function setUpSheet() {
  const sheet = getSheet()
  console.log('Ready: tab "' + sheet.getName() + '" with ' + sheet.getLastColumn() + ' columns.')
}

/**
 * Diagnostic. Not called by doPost - select it in the Apps Script editor's
 * function dropdown and press Run.
 *
 * Two reasons to use it instead of reading execution logs: it surfaces the error
 * directly in the editor, and running it interactively triggers the OAuth consent
 * prompt for sending mail, which a web-app request cannot do. If notifications
 * are failing because that scope was never granted, this both reveals and fixes
 * it - so run it once during setup rather than waiting for a real enquiry to
 * discover the scope is missing.
 */
function testEmail() {
  console.log('Remaining mail quota today: ' + MailApp.getRemainingDailyQuota())
  notify('testEmail@example.com', 'Test enquiry from the Apps Script editor.')
  const cc = ccAddress()
  if (cc) {
    console.log('Sent to ' + NOTIFY_TO + ' (cc ' + cc + '). Check both, including spam.')
  } else {
    console.warn(
      'Sent to ' + NOTIFY_TO + ' with NO cc: the CC_ADDRESS script property is not set, ' +
      'so the owner will not see a copy in their Inbox. Set it under Project Settings > Script properties.'
    )
  }
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
}
