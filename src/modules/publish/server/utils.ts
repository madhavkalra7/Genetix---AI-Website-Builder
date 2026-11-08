import "server-only";

/**
 * Normalise a configured base URL: trims spaces/slashes, removes a trailing dot on the
 * hostname ("example.vercel.app." breaks on Vercel), and rejects anything that isn't a valid
 * http(s) URL. Returns null when unusable.
 */
function normalizeBaseUrl(raw: string | undefined | null): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hostname = url.hostname.replace(/\.+$/, "");
    if (!url.hostname) return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

const toBase = (u: URL) => `${u.origin}${u.pathname}`.replace(/\/+$/, "");

/** The main app's own URL (where /s/<slug> is always served). */
function getAppUrl(): URL | null {
  return (
    normalizeBaseUrl(process.env.APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXTAUTH_URL)
  );
}

/**
 * Parsed PUBLISH_BASE_URL, only when it's a valid URL on a DIFFERENT host than the app.
 * (Setting it to the app's own domain — or with a typo like a trailing dot — must not break links.)
 */
export function getDedicatedPublishOrigin(): URL | null {
  const dedicated = normalizeBaseUrl(process.env.PUBLISH_BASE_URL);
  if (!dedicated) return null;
  const app = getAppUrl();
  if (app && app.host.toLowerCase() === dedicated.host.toLowerCase()) return null;
  return dedicated;
}

/** Base URL that published sites are served from (no trailing slash). */
export function getPublishBaseUrl(): string {
  const dedicated = getDedicatedPublishOrigin();
  if (dedicated) return toBase(dedicated);
  const app = getAppUrl();
  return app ? toBase(app) : "http://localhost:3000";
}

export const getPublishedSiteUrl = (slug: string) => `${getPublishBaseUrl()}/s/${slug}/`;
