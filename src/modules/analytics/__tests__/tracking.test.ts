import { describe, expect, it } from "vitest";
import {
    computeVisitorHash,
    getReferrerHost,
    getVisitorIp,
    isBotUserAgent,
    normalizeCountry,
    normalizeVisitPath,
} from "@/modules/analytics/tracking";
import { countryFlag, fillDailySeries, rangeStart } from "@/modules/analytics/shared";
import { badgeHtml, buildBadgeUrl, insertBeforeBodyEnd } from "@/modules/publish/badge";

const CHROME =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("isBotUserAgent", () => {
    it("lets real browsers through", () => {
        expect(isBotUserAgent(CHROME)).toBe(false);
        expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false);
    });

    it("flags crawlers, unfurlers, CLI tools, headless browsers and empty UAs", () => {
        for (const ua of [
            "Googlebot/2.1 (+http://www.google.com/bot.html)",
            "Mozilla/5.0 (compatible; bingbot/2.0)",
            "facebookexternalhit/1.1",
            "Slackbot-LinkExpanding 1.0",
            "Mozilla/5.0 (compatible; Discordbot/2.0)",
            "WhatsApp/2.23.20",
            "curl/8.4.0",
            "Wget/1.21",
            "Mozilla/5.0 HeadlessChrome/120.0",
            "SomeSpider/1.0",
            "LinkPreview/1.0",
            "",
            null,
        ]) {
            expect(isBotUserAgent(ua), String(ua)).toBe(true);
        }
    });
});

describe("normalizeVisitPath", () => {
    it("maps served file keys to clean page paths", () => {
        expect(normalizeVisitPath("index.html")).toBe("/");
        expect(normalizeVisitPath("about.html")).toBe("/about");
        expect(normalizeVisitPath("blog/index.html")).toBe("/blog");
        expect(normalizeVisitPath("/docs//intro/")).toBe("/docs/intro");
        expect(normalizeVisitPath("")).toBe("/");
        expect(normalizeVisitPath(undefined)).toBe("/");
    });

    it("drops query strings and caps the length at 200", () => {
        expect(normalizeVisitPath("/pricing?plan=pro#faq")).toBe("/pricing");
        expect(normalizeVisitPath("a".repeat(500))).toHaveLength(200);
    });
});

describe("getReferrerHost", () => {
    it("keeps only the host", () => {
        expect(getReferrerHost("https://www.google.com/search?q=genetix")).toBe("google.com");
        expect(getReferrerHost("http://news.ycombinator.com:8080/item?id=1")).toBe("news.ycombinator.com");
    });

    it("returns null for missing, invalid, non-http or same-host referrers", () => {
        expect(getReferrerHost(null)).toBeNull();
        expect(getReferrerHost("")).toBeNull();
        expect(getReferrerHost("not a url")).toBeNull();
        expect(getReferrerHost("android-app://com.slack")).toBeNull();
        expect(getReferrerHost("https://genetix.app/s/my-site/about", "genetix.app")).toBeNull();
        expect(getReferrerHost("https://www.genetix.app/s/x", "genetix.app:443")).toBeNull();
        expect(getReferrerHost("https://twitter.com/", "genetix.app")).toBe("twitter.com");
    });
});

describe("normalizeCountry / getVisitorIp", () => {
    it("accepts two-letter codes only", () => {
        expect(normalizeCountry("us")).toBe("US");
        expect(normalizeCountry("XX")).toBeNull();
        expect(normalizeCountry("USA")).toBeNull();
        expect(normalizeCountry(null)).toBeNull();
    });

    it("prefers the first x-forwarded-for hop", () => {
        expect(getVisitorIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1", "x-real-ip": "9.9.9.9" }))).toBe(
            "1.2.3.4"
        );
        expect(getVisitorIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
        expect(getVisitorIp(new Headers())).toBe("");
    });
});

describe("computeVisitorHash", () => {
    const day = new Date("2026-11-08T10:00:00Z");

    it("is deterministic within a UTC day and 32 hex chars", () => {
        const a = computeVisitorHash("1.2.3.4", CHROME, day, "secret");
        const b = computeVisitorHash("1.2.3.4", CHROME, new Date("2026-11-08T23:59:59Z"), "secret");
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{32}$/);
    });

    it("rotates daily and differs per ip / user agent / secret", () => {
        const a = computeVisitorHash("1.2.3.4", CHROME, day, "secret");
        expect(computeVisitorHash("1.2.3.4", CHROME, new Date("2026-11-09T00:00:00Z"), "secret")).not.toBe(a);
        expect(computeVisitorHash("1.2.3.5", CHROME, day, "secret")).not.toBe(a);
        expect(computeVisitorHash("1.2.3.4", "Other", day, "secret")).not.toBe(a);
        expect(computeVisitorHash("1.2.3.4", CHROME, day, "other")).not.toBe(a);
    });
});

describe("daily series helpers", () => {
    const now = new Date("2026-11-08T15:00:00Z");

    it("starts the range at UTC midnight", () => {
        expect(rangeStart(7, now).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    });

    it("fills every day with zeros where there is no data", () => {
        const series = fillDailySeries([{ date: "2026-11-05", views: 4, visitors: 2 }], 7, now);
        expect(series).toHaveLength(7);
        expect(series[0]).toEqual({ date: "2026-11-02", views: 0, visitors: 0 });
        expect(series[3]).toEqual({ date: "2026-11-05", views: 4, visitors: 2 });
        expect(series[6].date).toBe("2026-11-08");
    });

    it("builds flag emoji from country codes", () => {
        expect(countryFlag("us")).toBe("🇺🇸");
        expect(countryFlag("IN")).toBe("🇮🇳");
        expect(countryFlag("???")).toBe("");
    });
});

describe("Made with Genetix badge", () => {
    it("links to the app with ref + site params", () => {
        expect(buildBadgeUrl("https://genetix.app/", "my-site")).toBe("https://genetix.app/?ref=badge&site=my-site");
        const html = badgeHtml("https://genetix.app", "my-site");
        expect(html).toContain('href="https://genetix.app/?ref=badge&amp;site=my-site"');
        expect(html).toContain('target="_top" rel="noopener"');
        expect(html).toContain("z-index:2147483000");
        expect(html.length).toBeLessThan(1600);
    });

    it("is inserted before the last </body>, or appended", () => {
        expect(insertBeforeBodyEnd("<html><body><p>x</p></BODY></html>", "<b/>")).toBe(
            "<html><body><p>x</p><b/></BODY></html>"
        );
        expect(insertBeforeBodyEnd("<p>x</p>", "<b/>")).toBe("<p>x</p><b/>");
    });
});
