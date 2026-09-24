/**
 * cDot — contact form capture.
 *
 * Not part of the site build. This file is the source of the Google Apps Script
 * that receives contact enquiries straight from the browser (see the contact
 * form script in src/pages/index.astro), appends them to a spreadsheet, and
 * emails the team. It is kept in the repo so the script is versioned alongside
 * the form it serves.
 *
 * This is a SEPARATE deployment from the c.Email contact form
 * (c.email-website/scripts/contact-form.gs), with its own script and its own
 * spreadsheet. They deliberately share no infrastructure: editing one cannot
 * break the other, and cDot enquiries never mix into c.Email's sheet.
 *
 * The /exec URL is public: it ships in the page source. That is deliberate.
 * This script only ever appends a row and has no doGet, so holding the URL grants
 * no way to read the sheet — the worst it buys an abuser is junk rows and mail to
 * an address already published on the contact section anyway.
 *
 * Setup (do this on the Certonymity Workspace account, not a personal Gmail —
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
 *      the spreadsheet readable — this script only ever appends.
 *   5. Copy the /exec URL into CONTACT_FORM_URL in src/pages/index.astro.
 *
 * Re-deploy after editing, or the live endpoint keeps running the old version.
 */

const SHEET_NAME = 'Enquiries'

// Where cDot enquiries are emailed. The cDot form has no enquiry-type selector,
// so unlike the c.Email script there is nothing to route on — one destination,
// declared once.
const NOTIFY_TO = 'info@certonymity.com'

// Long enough for a real enquiry, short enough that the sheet cell stays usable
// and a bot can't dump megabytes into it. Apps Script caps a cell at 50k chars.
// Keep in sync with the maxlength on the textarea in src/pages/index.astro.
const MAX_MESSAGE_LENGTH = 5000

// Must stay empty. The form calls this script directly from the browser, so any
// value here would ship to the client alongside it — a secret everyone can read
// is not a secret. The honeypot below is what filters bots.
const SHARED_SECRET = ''

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)

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
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ ok: false, error: 'Please enter a valid email address.' })
    }

    const message = String(body.message || '').trim()
    if (!message) {
      return reply({ ok: false, error: 'Please enter a message.' })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return reply({ ok: false, error: 'That message is too long. Please shorten it, or email us directly.' })
    }

    // The row is the record of the enquiry, so write it before attempting mail.
    getSheet().appendRow([new Date(), email, message])

    // The row is the enquiry; the email is how anyone finds out about it. A silent
    // notification failure means a person believes they contacted us and nobody
    // ever replies — so surface it and ask them to email directly, even though we
    // did save their message.
    try {
      notify(email, message)
    } catch (err) {
      console.error('Enquiry recorded but notification failed:', err)
      return reply({ ok: false, error: 'We saved your message but could not alert the team. Please email us directly so nothing is missed.' })
    }

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
  // Otherwise a tab that already exists — because it was renamed by hand, or had
  // its rows cleared — silently collects three unlabelled columns forever.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Email', 'Message'])
    sheet.setFrozenRows(1)
  }
  return sheet
}

function notify(email, message) {
  MailApp.sendEmail({
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
      '—',
      'Logged in ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    ].join('\n'),
  })
}

/**
 * Setup helper. Not called by doPost — select it in the Apps Script editor's
 * function dropdown and press Run.
 *
 * Creates the Enquiries tab and its header row without sending any mail, so the
 * sheet is visibly ready before the first real enquiry arrives. Until something
 * submits successfully the spreadsheet stays empty, which reads as a broken form
 * even though nothing is wrong — this removes that ambiguity.
 */
function setUpSheet() {
  const sheet = getSheet()
  console.log('Ready: tab "' + sheet.getName() + '" with ' + sheet.getLastColumn() + ' columns.')
}

/**
 * Diagnostic. Not called by doPost — select it in the Apps Script editor's
 * function dropdown and press Run.
 *
 * Two reasons to use it instead of reading execution logs: it surfaces the error
 * directly in the editor, and running it interactively triggers the OAuth consent
 * prompt for sending mail, which a web-app request cannot do. If notifications
 * are failing because that scope was never granted, this both reveals and fixes
 * it — so run it once during setup rather than waiting for a real enquiry to
 * discover the scope is missing.
 */
function testEmail() {
  console.log('Remaining mail quota today: ' + MailApp.getRemainingDailyQuota())
  notify('testEmail@example.com', 'Test enquiry from the Apps Script editor.')
  console.log('Sent to ' + NOTIFY_TO + '. Check that inbox, including spam.')
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
}
