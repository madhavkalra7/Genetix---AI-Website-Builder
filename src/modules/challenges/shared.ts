/**
 * Pure (DB-free) logic for Weekly Build Challenges. Safe to import from client and server.
 *
 * Cadence: each challenge runs for one ISO week in UTC — Monday 00:00:00.000 to
 * Sunday 23:59:59.999.
 *
 * Score (deterministic, computed at query time):
 *   score = uniqueVisitors + REMIX_POINTS × remixCount
 * where uniqueVisitors = for each UTC day in the challenge window, the number of distinct
 * visitor hashes that viewed the entry's published site, summed over the days (the visitor
 * hash rotates daily, so this is "unique visitors per day"). remixCount is the site's current
 * gallery remix count. Ties are broken by earlier submission, then by entry id.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

/** Points per remix of the entry's site. */
export const REMIX_POINTS = 5;
/** Max entries one user may submit to a single challenge. */
export const MAX_ENTRIES_PER_USER = 3;
/** Final ranks are stored for this many placings. */
export const RANKED_PLACES = 10;
/** Prize share for 1st / 2nd / 3rd as a fraction of the challenge's prizeCredits. */
export const PRIZE_SHARES = [1, 0.5, 0.25] as const;
export const LEADERBOARD_MAX = 50;

export interface IsoWeek {
    /** ISO week-numbering year (may differ from the calendar year around New Year). */
    year: number;
    /** 1..53 */
    week: number;
}

/** ISO-8601 week number of the given instant, evaluated in UTC. */
export function getIsoWeek(date: Date): IsoWeek {
    // Shift to the Thursday of this week: its calendar year is the ISO year.
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7; // Mon=1 .. Sun=7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const yearStart = Date.UTC(year, 0, 1);
    const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
    return { year, week };
}

export interface WeekWindow {
    /** Monday 00:00:00.000 UTC */
    startsAt: Date;
    /** Sunday 23:59:59.999 UTC */
    endsAt: Date;
}

/** The Monday→Sunday UTC window containing `date`. */
export function getWeekWindow(date: Date): WeekWindow {
    const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const dayNum = new Date(midnight).getUTCDay() || 7;
    const start = midnight - (dayNum - 1) * DAY_MS;
    return { startsAt: new Date(start), endsAt: new Date(start + WEEK_MS - 1) };
}

/** Monday 1970-01-05 00:00 UTC — the first ISO-week Monday after the Unix epoch. */
const EPOCH_MONDAY_MS = Date.UTC(1970, 0, 5);

/**
 * Absolute number of whole weeks since 1970-01-05 (UTC). Consecutive weeks get consecutive
 * numbers, so `index % catalog.length` rotates through every catalog item without repeats.
 */
export function getWeekSerial(date: Date): number {
    return Math.floor((getWeekWindow(date).startsAt.getTime() - EPOCH_MONDAY_MS) / WEEK_MS);
}

/** Deterministic catalog pick for the week containing `date`. */
export function pickCatalogIndex(date: Date, catalogLength: number): number {
    if (catalogLength <= 0) throw new Error("Challenge catalog is empty");
    const serial = getWeekSerial(date);
    return ((serial % catalogLength) + catalogLength) % catalogLength;
}

/** Challenge slug for a catalog base + ISO week, e.g. "retro-arcade-2026-w46". */
export function challengeSlug(base: string, date: Date): string {
    const { year, week } = getIsoWeek(date);
    return `${base}-${year}-w${String(week).padStart(2, "0")}`;
}

export function isChallengeOpen(
    challenge: { startsAt: Date | string; endsAt: Date | string },
    now: Date = new Date()
): boolean {
    const t = now.getTime();
    return new Date(challenge.startsAt).getTime() <= t && t <= new Date(challenge.endsAt).getTime();
}

/** Credits for 1st, 2nd and 3rd place (100% / 50% / 25%, rounded down, never negative). */
export function prizeSplit(prizeCredits: number): number[] {
    const base = Math.max(0, Math.floor(prizeCredits));
    return PRIZE_SHARES.map((share) => Math.floor(base * share));
}

export interface ScoreBreakdown {
    visitors: number;
    remixes: number;
    remixPoints: number;
    score: number;
}

export function computeScore(visitors: number, remixes: number): ScoreBreakdown {
    const v = Math.max(0, Math.floor(visitors));
    const r = Math.max(0, Math.floor(remixes));
    const remixPoints = r * REMIX_POINTS;
    return { visitors: v, remixes: r, remixPoints, score: v + remixPoints };
}

export interface RankableEntry {
    id: string;
    userId: string;
    score: number;
    createdAt: Date | string;
}

/** Highest score first; ties → earlier submission first; then entry id for full determinism. */
export function compareEntries(a: RankableEntry, b: RankableEntry): number {
    if (b.score !== a.score) return b.score - a.score;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortEntries<T extends RankableEntry>(entries: readonly T[]): T[] {
    return [...entries].sort(compareEntries);
}

export interface FinalPlacing<T> {
    entry: T;
    rank: number;
    prize: number;
}

/**
 * Final placings: only each user's best entry counts, ranks 1..RANKED_PLACES go to distinct
 * users, and the top 3 get prizes per `prizeSplit`. Entries with zero score still place
 * (ties resolved by submission time) — someone who entered should still be ranked.
 */
export function computeFinalPlacings<T extends RankableEntry>(
    entries: readonly T[],
    prizeCredits: number,
    places: number = RANKED_PLACES
): FinalPlacing<T>[] {
    const prizes = prizeSplit(prizeCredits);
    const seen = new Set<string>();
    const placings: FinalPlacing<T>[] = [];
    for (const entry of sortEntries(entries)) {
        if (seen.has(entry.userId)) continue;
        seen.add(entry.userId);
        const rank = placings.length + 1;
        placings.push({ entry, rank, prize: prizes[rank - 1] ?? 0 });
        if (placings.length >= places) break;
    }
    return placings;
}

/** "3d 4h", "5h 12m", "42m", "<1m", or "Ended". */
export function formatTimeLeft(ms: number): string {
    if (ms <= 0) return "Ended";
    const totalMinutes = Math.floor(ms / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return "<1m";
}
