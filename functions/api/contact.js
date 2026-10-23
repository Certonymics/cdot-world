/* POST /api/contact - the contact form's endpoint (Cloudflare Pages Function).
   All the logic is in ../_lib/contact.mjs so it can be tested in Node. The form
   only posts here when src/data/forms.mjs says "cloudflare"; until then it still
   posts to the Google Apps Script and this route sits unused. */
import { handleContact } from "../_lib/contact.mjs";

export const onRequest = ({ request, env }) => handleContact(request, env);
