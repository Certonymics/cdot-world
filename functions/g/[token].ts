// A bare token, or the full alias for a group on another homeserver.
const TOKEN = /^[0-9a-f]{32}$/;
const ALIAS = /^#g-[0-9a-f]{32}:[^\s/]+$/;

const isGroupLink = (segment: unknown): boolean => {
  try {
    const value = decodeURIComponent(String(segment ?? ""));
    return TOKEN.test(value) || ALIAS.test(value);
  } catch {
    return false;
  }
};

export const onRequestGet: PagesFunction = async ({ request, params, env }) => {
  if (!isGroupLink(params.token)) {
    const page = await env.ASSETS.fetch(
      new Request(new URL("/404", request.url), request),
    );
    return new Response(page.body, { status: 404, headers: page.headers });
  }
  const page = new URL("/group/", request.url);
  return env.ASSETS.fetch(new Request(page, request));
};
