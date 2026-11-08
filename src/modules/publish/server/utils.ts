import "server-only";

/** Base URL that published sites are served from (no trailing slash). */
export function getPublishBaseUrl(): string {
    const raw =
        process.env.PUBLISH_BASE_URL ||
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000";
    return raw.trim().replace(/\/+$/, "");
}

export const getPublishedSiteUrl = (slug: string) => `${getPublishBaseUrl()}/s/${slug}/`;

/** Parsed PUBLISH_BASE_URL (only when explicitly configured and valid). */
export function getDedicatedPublishOrigin(): URL | null {
    const raw = process.env.PUBLISH_BASE_URL?.trim();
    if (!raw) return null;
    try {
        return new URL(raw);
    } catch {
        return null;
    }
}
