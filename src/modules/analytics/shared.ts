// Shared (client + server safe) analytics helpers.

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** Visits older than this are deleted opportunistically. */
export const VISIT_RETENTION_DAYS = 180;

export interface DailyPoint {
    /** "YYYY-MM-DD" (UTC) */
    date: string;
    views: number;
    visitors: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of the first day of a `days`-long range ending today (inclusive). */
export function rangeStart(days: number, now: Date = new Date()): Date {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return new Date(today - (days - 1) * DAY_MS);
}

/** One entry per UTC day in the range (oldest first), zero-filled where there's no data. */
export function fillDailySeries(
    rows: { date: string; views: number; visitors: number }[],
    days: number,
    now: Date = new Date()
): DailyPoint[] {
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const start = rangeStart(days, now).getTime();
    const out: DailyPoint[] = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
        const row = byDate.get(date);
        out.push({ date, views: row?.views ?? 0, visitors: row?.visitors ?? 0 });
    }
    return out;
}

/** "US" -> 🇺🇸 (regional indicator symbols). Empty string for invalid codes. */
export function countryFlag(code: string | null | undefined): string {
    const cc = code?.trim().toUpperCase();
    if (!cc || !/^[A-Z]{2}$/.test(cc)) return "";
    return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Localised country name ("US" -> "United States"), falling back to the code. */
export function countryName(code: string, locale?: string): string {
    try {
        return new Intl.DisplayNames(locale ? [locale] : undefined, { type: "region" }).of(code) ?? code;
    } catch {
        return code;
    }
}
