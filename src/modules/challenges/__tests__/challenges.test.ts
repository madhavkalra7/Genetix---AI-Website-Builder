import { describe, expect, it } from "vitest";
import {
    challengeSlug,
    computeFinalPlacings,
    computeScore,
    formatTimeLeft,
    getIsoWeek,
    getWeekSerial,
    getWeekWindow,
    isChallengeOpen,
    pickCatalogIndex,
    prizeSplit,
    sortEntries,
} from "@/modules/challenges/shared";
import { CHALLENGE_CATALOG, getCatalogChallengeForDate } from "@/modules/challenges/catalog";

const utc = (s: string) => new Date(`${s}Z`);

describe("getIsoWeek", () => {
    it("matches known ISO weeks", () => {
        expect(getIsoWeek(utc("2026-11-09T12:00:00"))).toEqual({ year: 2026, week: 46 });
        expect(getIsoWeek(utc("2026-01-01T00:00:00"))).toEqual({ year: 2026, week: 1 });
        expect(getIsoWeek(utc("2021-01-03T23:59:59"))).toEqual({ year: 2020, week: 53 });
        expect(getIsoWeek(utc("2024-12-30T00:00:00"))).toEqual({ year: 2025, week: 1 });
        expect(getIsoWeek(utc("2027-01-01T00:00:00"))).toEqual({ year: 2026, week: 53 });
    });

    it("uses UTC regardless of local time", () => {
        // Sunday 23:30 UTC is still the previous ISO week
        expect(getIsoWeek(utc("2026-11-15T23:30:00")).week).toBe(46);
        expect(getIsoWeek(utc("2026-11-16T00:00:00")).week).toBe(47);
    });
});

describe("getWeekWindow", () => {
    it("runs Monday 00:00 to Sunday 23:59:59.999 UTC", () => {
        const w = getWeekWindow(utc("2026-11-11T15:00:00"));
        expect(w.startsAt.toISOString()).toBe("2026-11-09T00:00:00.000Z");
        expect(w.endsAt.toISOString()).toBe("2026-11-15T23:59:59.999Z");
    });

    it("handles the exact boundaries", () => {
        expect(getWeekWindow(utc("2026-11-09T00:00:00")).startsAt.toISOString()).toBe("2026-11-09T00:00:00.000Z");
        expect(getWeekWindow(utc("2026-11-15T23:59:59.999")).startsAt.toISOString()).toBe(
            "2026-11-09T00:00:00.000Z"
        );
        expect(getWeekWindow(utc("2026-11-16T00:00:00")).startsAt.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    });

    it("crosses year boundaries", () => {
        const w = getWeekWindow(utc("2027-01-01T08:00:00"));
        expect(w.startsAt.toISOString()).toBe("2026-12-28T00:00:00.000Z");
        expect(w.endsAt.toISOString()).toBe("2027-01-03T23:59:59.999Z");
    });

    it("isChallengeOpen respects inclusive boundaries", () => {
        const w = getWeekWindow(utc("2026-11-11T00:00:00"));
        expect(isChallengeOpen(w, w.startsAt)).toBe(true);
        expect(isChallengeOpen(w, w.endsAt)).toBe(true);
        expect(isChallengeOpen(w, new Date(w.endsAt.getTime() + 1))).toBe(false);
        expect(isChallengeOpen(w, new Date(w.startsAt.getTime() - 1))).toBe(false);
    });
});

describe("catalog pick", () => {
    it("has ~20 unique, well-formed challenges", () => {
        expect(CHALLENGE_CATALOG.length).toBeGreaterThanOrEqual(20);
        const bases = new Set(CHALLENGE_CATALOG.map((c) => c.base));
        expect(bases.size).toBe(CHALLENGE_CATALOG.length);
        for (const c of CHALLENGE_CATALOG) {
            expect(c.base).toMatch(/^[a-z0-9-]+$/);
            expect(c.title && c.description && c.prompt).toBeTruthy();
            expect(c.prizeCredits).toBeGreaterThan(0);
        }
    });

    it("is deterministic within a week and rotates week to week", () => {
        const monday = utc("2026-11-09T00:00:00");
        const sunday = utc("2026-11-15T23:59:59");
        const a = getCatalogChallengeForDate(monday);
        expect(getCatalogChallengeForDate(sunday).slug).toBe(a.slug);
        expect(a.slug).toBe(`${a.base}-2026-w46`);

        const seen = new Set<number>();
        for (let i = 0; i < CHALLENGE_CATALOG.length; i++) {
            seen.add(pickCatalogIndex(new Date(monday.getTime() + i * 7 * 86_400_000), CHALLENGE_CATALOG.length));
        }
        expect(seen.size).toBe(CHALLENGE_CATALOG.length); // full cycle without repeats
    });

    it("week serials are consecutive", () => {
        expect(getWeekSerial(utc("2026-11-16T00:00:00")) - getWeekSerial(utc("2026-11-15T23:59:59"))).toBe(1);
        expect(getWeekSerial(utc("1970-01-05T00:00:00"))).toBe(0);
    });

    it("builds padded slugs", () => {
        expect(challengeSlug("space-week", utc("2026-01-05T00:00:00"))).toBe("space-week-2026-w02");
    });
});

describe("prizeSplit", () => {
    it("pays 100% / 50% / 25%", () => {
        expect(prizeSplit(100)).toEqual([100, 50, 25]);
        expect(prizeSplit(150)).toEqual([150, 75, 37]);
        expect(prizeSplit(0)).toEqual([0, 0, 0]);
        expect(prizeSplit(-5)).toEqual([0, 0, 0]);
    });
});

describe("scoring and ranking", () => {
    it("computes score = visitors + 5 × remixes", () => {
        expect(computeScore(12, 3)).toEqual({ visitors: 12, remixes: 3, remixPoints: 15, score: 27 });
    });

    it("sorts by score desc, then earlier submission, then id", () => {
        const entries = [
            { id: "c", userId: "u1", score: 10, createdAt: utc("2026-11-10T10:00:00") },
            { id: "a", userId: "u2", score: 10, createdAt: utc("2026-11-09T10:00:00") },
            { id: "b", userId: "u3", score: 20, createdAt: utc("2026-11-12T10:00:00") },
            { id: "d", userId: "u4", score: 10, createdAt: utc("2026-11-09T10:00:00") },
        ];
        expect(sortEntries(entries).map((e) => e.id)).toEqual(["b", "a", "d", "c"]);
    });

    it("counts one (best) entry per user and pays the top 3 distinct users", () => {
        const t = utc("2026-11-10T00:00:00");
        const entries = [
            { id: "e1", userId: "alice", score: 50, createdAt: t },
            { id: "e2", userId: "alice", score: 40, createdAt: t },
            { id: "e3", userId: "bob", score: 30, createdAt: t },
            { id: "e4", userId: "carol", score: 30, createdAt: new Date(t.getTime() + 1000) },
            { id: "e5", userId: "dave", score: 5, createdAt: t },
        ];
        const placings = computeFinalPlacings(entries, 100);
        expect(placings.map((p) => [p.entry.id, p.rank, p.prize])).toEqual([
            ["e1", 1, 100],
            ["e3", 2, 50],
            ["e4", 3, 25],
            ["e5", 4, 0],
        ]);
    });

    it("caps ranked places", () => {
        const entries = Array.from({ length: 15 }, (_, i) => ({
            id: `e${i}`,
            userId: `u${i}`,
            score: i,
            createdAt: new Date(0),
        }));
        const placings = computeFinalPlacings(entries, 100);
        expect(placings).toHaveLength(10);
        expect(placings[0]!.entry.id).toBe("e14");
        expect(computeFinalPlacings([], 100)).toEqual([]);
    });
});

describe("formatTimeLeft", () => {
    it("formats durations", () => {
        expect(formatTimeLeft(0)).toBe("Ended");
        expect(formatTimeLeft(30_000)).toBe("<1m");
        expect(formatTimeLeft(42 * 60_000)).toBe("42m");
        expect(formatTimeLeft((5 * 60 + 12) * 60_000)).toBe("5h 12m");
        expect(formatTimeLeft((3 * 24 + 4) * 3_600_000 + 59_000)).toBe("3d 4h");
    });
});
