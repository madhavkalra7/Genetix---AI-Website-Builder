import { createHash } from "crypto";

/**
 * Pure helpers for privacy-friendly published-site analytics (no cookies, no stored IPs).
 * Kept free of Prisma / "server-only" so they can be unit tested; only import from server code.
 */

export const VISIT_PATH_MAX_LENGTH = 200;
const REFERRER_HOST_MAX_LENGTH = 253;

const BOT_UA_REGEX =
    /bot|crawl|spider|preview|facebookexternalhit|slackbot|discord|whatsapp|curl|wget|headless/i;

/** True for crawlers, link unfurlers, CLI tools and headless browsers (and an empty UA). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
    const ua = userAgent?.trim();
    if (!ua) return true;
    return BOT_UA_REGEX.test(ua);
}

/**
 * Canonical page path for a served file key:
 * "index.html" -> "/", "about.html" -> "/about", "blog/index.html" -> "/blog", "/a//b/" -> "/a/b".
 * Query strings / hashes are dropped and the result is capped at 200 characters.
 */
export function normalizeVisitPath(raw: string | null | undefined): string {
    let p = (raw ?? "").split(/[?#]/)[0].replace(/\\/g, "/");
    p = `/${p}`.replace(/\/{2,}/g, "/");
    p = p.replace(/\/index\.html?$/i, "/").replace(/\.html?$/i, "");
    if (p.length > 1) p = p.replace(/\/+$/, "");
    return (p || "/").slice(0, VISIT_PATH_MAX_LENGTH);
}

const bareHost = (host: string) => host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "").replace(/^www\./, "");

/**
 * Host part of a Referer header ("https://www.google.com/search?q=x" -> "google.com").
 * Returns null when missing, not http(s), unparsable, or the same host as the site itself
 * (internal navigation).
 */
export function getReferrerHost(referer: string | null | undefined, selfHost?: string | null): string | null {
    const value = referer?.trim();
    if (!value) return null;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = bareHost(url.hostname);
    if (!host) return null;
    if (selfHost && host === bareHost(selfHost)) return null;
    return host.slice(0, REFERRER_HOST_MAX_LENGTH);
}

/** ISO 3166-1 alpha-2 country from the `x-vercel-ip-country` header (null when absent/invalid). */
export function normalizeCountry(raw: string | null | undefined): string | null {
    const value = raw?.trim().toUpperCase();
    if (!value || !/^[A-Z]{2}$/.test(value) || value === "XX") return null;
    return value;
}

/** Best-effort client IP: first x-forwarded-for hop, then x-real-ip. */
export function getVisitorIp(headers: Headers): string {
    const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (first) return first;
    return headers.get("x-real-ip")?.trim() || "";
}

/** "YYYY-MM-DD" in UTC. */
export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Daily-rotating, non-reversible visitor id: sha256(ip + userAgent + UTC day + secret), 32 hex chars.
 * The same person gets a new id every day, so visitors can't be tracked across days.
 */
export function computeVisitorHash(
    ip: string,
    userAgent: string,
    date: Date = new Date(),
    secret: string = process.env.NEXTAUTH_SECRET || "genetix"
): string {
    return createHash("sha256")
        .update(ip + userAgent + utcDay(date) + secret)
        .digest("hex")
        .slice(0, 32);
}
