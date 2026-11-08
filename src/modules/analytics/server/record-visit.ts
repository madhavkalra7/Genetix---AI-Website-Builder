import "server-only";
import { prisma } from "@/lib/db";
import {
    computeVisitorHash,
    getReferrerHost,
    getVisitorIp,
    isBotUserAgent,
    normalizeCountry,
    normalizeVisitPath,
} from "@/modules/analytics/tracking";

interface RecordVisitInput {
    siteId: string;
    /** Served file key or request path; normalized here. */
    path: string;
    method: string;
    headers: Headers;
    /** Host the request arrived on (internal navigation referrers are dropped). */
    host: string;
}

/**
 * Records a page view for a published site. Skips HEAD (non-GET) requests and bots.
 * The returned promise NEVER rejects, so callers can fire-and-forget it (or pass it to
 * `after()` so serverless runtimes finish the write after the response is sent).
 */
export async function recordSiteVisit({ siteId, path, method, headers, host }: RecordVisitInput): Promise<void> {
    try {
        if (method.toUpperCase() !== "GET") return;
        const userAgent = headers.get("user-agent") ?? "";
        if (isBotUserAgent(userAgent)) return;

        await prisma.siteVisit.create({
            data: {
                siteId,
                path: normalizeVisitPath(path),
                country: normalizeCountry(headers.get("x-vercel-ip-country")),
                referrer: getReferrerHost(headers.get("referer"), host),
                visitorHash: computeVisitorHash(getVisitorIp(headers), userAgent),
            },
        });
    } catch (err) {
        console.error("[analytics] failed to record visit:", err);
    }
}
