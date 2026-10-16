// The chat invite link, https://cdot.world/i/<handle>, for a phone without the
// app (a phone with it opens the link in the app directly, as a universal link
// claimed through /.well-known). Android goes to Google Play with the handle in
// the install referrer, which the app reads at first launch to start the chat;
// iOS goes to the App Store once the app is listed there. Anything else gets
// the invite page, which shows the handle and the store link.

const PLAY_URL =
  "https://play.google.com/store/apps/details?id=org.certonym.cdot";
// The App Store listing for org.certonym.cdot. Empty until the app is in the
// App Store: an iPhone then lands on the invite page like a desktop browser.
const APP_STORE_URL = "";

// A bare localpart (quiet-falcon-4821) or a full Matrix id (@bob:matrix.org).
const HANDLE = /^[^\s/]+$/;

// The path segment arrives still percent-encoded (/i/%40bob%3Amatrix.org), so
// it is decoded once here and the referrer carries the plain handle, encoded
// once as a query value: invite=%40bob%3Amatrix.org.
const decodeHandle = (segment: unknown): string | null => {
  try {
    const handle = decodeURIComponent(String(segment ?? ""));
    return HANDLE.test(handle) ? handle : null;
  } catch {
    return null;
  }
};

export const onRequestGet: PagesFunction = async ({ request, params, env }) => {
  const handle = decodeHandle(params.handle);
  if (!handle) return new Response("Not found", { status: 404 });
  const ua = request.headers.get("user-agent") ?? "";
  if (/android/i.test(ua)) {
    const referrer = new URLSearchParams({
      utm_source: "cdot_invite",
      invite: handle,
    });
    return Response.redirect(
      `${PLAY_URL}&referrer=${encodeURIComponent(referrer.toString())}`,
      302,
    );
  }
  if (APP_STORE_URL && /iphone|ipad|ipod/i.test(ua)) {
    return Response.redirect(APP_STORE_URL, 302);
  }
  // The static invite page, built by Astro from src/pages/invite.astro; it
  // reads the handle off location.pathname.
  const page = new URL("/invite/", request.url);
  return env.ASSETS.fetch(new Request(page, request));
};
