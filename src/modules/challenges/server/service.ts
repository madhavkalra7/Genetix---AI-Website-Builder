import "server-only";

import { Prisma, type Challenge } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { getPublishedSiteUrl } from "@/modules/publish/server/utils";
import { getCatalogChallengeForDate } from "../catalog";
import {
    computeFinalPlacings,
    computeScore,
    isChallengeOpen,
    prizeSplit,
    sortEntries,
    type ScoreBreakdown,
} from "../shared";

const isUniqueViolation = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Public display name: first name, else username — never the email address. */
export const displayName = (user: { firstName: string | null; username: string | null } | undefined) =>
    user?.firstName?.trim() || user?.username?.trim() || "Genetix creator";

/** The challenge whose window covers `now` (latest start wins, so manual admin rows override). */
export async function findActiveChallenge(now: Date = new Date()) {
    return prisma.challenge.findFirst({
        where: { startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    });
}

/**
 * Returns the challenge running right now, creating this week's catalog challenge if none
 * exists. Idempotent and race-safe (unique slug + upsert, P2002 → re-read).
 */
export async function ensureCurrentChallenge(now: Date = new Date()): Promise<Challenge> {
    const active = await findActiveChallenge(now);
    if (active) return active;

    const spec = getCatalogChallengeForDate(now);
    const data = {
        slug: spec.slug,
        title: spec.title,
        description: spec.description,
        prompt: spec.prompt,
        startsAt: spec.startsAt,
        endsAt: spec.endsAt,
        prizeCredits: spec.prizeCredits,
    };
    try {
        return await prisma.challenge.upsert({ where: { slug: spec.slug }, create: data, update: {} });
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        return prisma.challenge.findUniqueOrThrow({ where: { slug: spec.slug } });
    }
}

type EntryRow = {
    id: string;
    challengeId: string;
    projectId: string;
    siteId: string;
    userId: string;
    rank: number | null;
    createdAt: Date;
};

export interface ScoredEntry extends EntryRow {
    breakdown: ScoreBreakdown;
    score: number;
    site: { id: string; slug: string; title: string | null; remixCount: number } | null;
}

/**
 * Scores entries at query time (see shared.ts for the formula): distinct visitor hashes per UTC
 * day within the challenge window, summed, plus REMIX_POINTS × current remixCount. Visits to both
 * the site id stored at submission and the project's current site id (after a re-publish) count.
 */
export async function scoreEntries(
    challenge: Pick<Challenge, "startsAt" | "endsAt">,
    entries: EntryRow[]
): Promise<ScoredEntry[]> {
    if (entries.length === 0) return [];

    const sites = await prisma.publishedSite.findMany({
        where: { projectId: { in: [...new Set(entries.map((e) => e.projectId))] } },
        select: { id: true, slug: true, title: true, remixCount: true, projectId: true },
    });
    const siteByProject = new Map(sites.map((s) => [s.projectId, s]));

    const siteIds = new Set<string>();
    for (const e of entries) {
        siteIds.add(e.siteId);
        const current = siteByProject.get(e.projectId);
        if (current) siteIds.add(current.id);
    }

    const rows = await prisma.$queryRaw<{ siteId: string; visitors: number }[]>`
        SELECT "siteId", COUNT(DISTINCT (to_char("createdAt", 'YYYY-MM-DD') || '|' || "visitorHash"))::int AS "visitors"
        FROM "SiteVisit"
        WHERE "siteId" IN (${Prisma.join([...siteIds])})
          AND "createdAt" >= ${challenge.startsAt}
          AND "createdAt" <= ${challenge.endsAt}
        GROUP BY "siteId"
    `;
    const visitorsBySite = new Map(rows.map((r) => [r.siteId, Number(r.visitors) || 0]));

    return entries.map((entry) => {
        const current = siteByProject.get(entry.projectId) ?? null;
        const ids = new Set([entry.siteId, ...(current ? [current.id] : [])]);
        let visitors = 0;
        for (const id of ids) visitors += visitorsBySite.get(id) ?? 0;
        const breakdown = computeScore(visitors, current?.remixCount ?? 0);
        return {
            ...entry,
            breakdown,
            score: breakdown.score,
            site: current
                ? { id: current.id, slug: current.slug, title: current.title, remixCount: current.remixCount }
                : null,
        };
    });
}

export interface LeaderboardItem {
    entryId: string;
    position: number;
    rank: number | null;
    projectId: string;
    title: string;
    author: string;
    slug: string;
    url: string;
    previewPath: string;
    score: number;
    breakdown: ScoreBreakdown;
    submittedAt: Date;
}

/**
 * Public leaderboard. Entries whose site was unpublished or project deleted are hidden.
 * Awarded challenges list their final ranks first (frozen at payout), then everyone else by score.
 */
export async function getLeaderboard(
    challenge: Pick<Challenge, "id" | "startsAt" | "endsAt" | "awardedAt">,
    limit: number
): Promise<{ items: LeaderboardItem[]; total: number }> {
    const entries = await prisma.challengeEntry.findMany({ where: { challengeId: challenge.id } });
    const scored = (await scoreEntries(challenge, entries)).filter((e) => e.site);

    const projects = await prisma.project.findMany({
        where: { id: { in: scored.map((e) => e.projectId) } },
        select: { id: true, name: true },
    });
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const visible = scored.filter((e) => projectById.has(e.projectId));

    let ordered = sortEntries(visible);
    if (challenge.awardedAt) {
        const ranked = visible.filter((e) => e.rank != null).sort((a, b) => a.rank! - b.rank!);
        const rest = ordered.filter((e) => e.rank == null);
        ordered = [...ranked, ...rest];
    }
    const page = ordered.slice(0, limit);

    const users = await prisma.user.findMany({
        where: { id: { in: [...new Set(page.map((e) => e.userId))] } },
        select: { id: true, firstName: true, username: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const items = page.map((e, i) => {
        const site = e.site!;
        return {
            entryId: e.id,
            position: i + 1,
            rank: e.rank,
            projectId: e.projectId,
            title: site.title?.trim() || projectById.get(e.projectId)?.name || "Untitled",
            author: displayName(userById.get(e.userId)),
            slug: site.slug,
            url: getPublishedSiteUrl(site.slug),
            previewPath: `/s/${encodeURIComponent(site.slug)}`,
            score: e.score,
            breakdown: e.breakdown,
            submittedAt: e.createdAt,
        };
    });
    return { items, total: visible.length };
}

export function serializeChallenge(challenge: Challenge, now: Date = new Date()) {
    return {
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        description: challenge.description,
        prompt: challenge.prompt,
        startsAt: challenge.startsAt,
        endsAt: challenge.endsAt,
        prizeCredits: challenge.prizeCredits,
        prizes: prizeSplit(challenge.prizeCredits),
        awardedAt: challenge.awardedAt,
        isOpen: isChallengeOpen(challenge, now),
        timeLeftMs: Math.max(0, challenge.endsAt.getTime() - now.getTime()),
    };
}

export interface AwardResult {
    challengeId: string;
    status: "awarded" | "skipped";
    winners: { userId: string; rank: number; prize: number }[];
}

/**
 * Finalises one ended challenge: ranks each user's best entry (top RANKED_PLACES), credits the
 * top 3 by raising UserCredits.creditsLimit, and stamps awardedAt. Idempotent: the payout runs in
 * one transaction that first claims the challenge (awardedAt null → now, must hit exactly 1 row),
 * so concurrent or repeated runs pay out at most once.
 */
export async function awardChallenge(challengeId: string, now: Date = new Date()): Promise<AwardResult> {
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.awardedAt || challenge.endsAt >= now) {
        return { challengeId, status: "skipped", winners: [] };
    }

    const entries = await prisma.challengeEntry.findMany({ where: { challengeId } });
    const scored = await scoreEntries(challenge, entries);

    // Only entries that are still live and whose author still exists can place.
    const users = await prisma.user.findMany({
        where: { id: { in: [...new Set(scored.map((e) => e.userId))] } },
        select: { id: true },
    });
    const existingUsers = new Set(users.map((u) => u.id));
    const eligible = scored.filter((e) => e.site && existingUsers.has(e.userId));
    const placings = computeFinalPlacings(eligible, challenge.prizeCredits);

    return prisma.$transaction(async (tx) => {
        const claim = await tx.challenge.updateMany({
            where: { id: challengeId, awardedAt: null },
            data: { awardedAt: now },
        });
        if (claim.count !== 1) return { challengeId, status: "skipped" as const, winners: [] };

        await tx.challengeEntry.updateMany({ where: { challengeId }, data: { rank: null } });
        for (const { entry, rank, prize } of placings) {
            await tx.challengeEntry.update({ where: { id: entry.id }, data: { rank } });
            if (prize > 0) {
                await tx.userCredits.upsert({
                    where: { userId: entry.userId },
                    update: { creditsLimit: { increment: prize } },
                    create: {
                        userId: entry.userId,
                        creditsUsed: 0,
                        creditsLimit: 3 + prize, // free plan default + prize
                        lastReset: new Date(),
                    },
                });
            }
        }
        return {
            challengeId,
            status: "awarded" as const,
            winners: placings
                .filter((p) => p.prize > 0)
                .map((p) => ({ userId: p.entry.userId, rank: p.rank, prize: p.prize })),
        };
    });
}

/** Ended challenges that haven't paid out yet (oldest first). */
export async function findUnawardedEndedChallenges(now: Date = new Date(), take = 10) {
    return prisma.challenge.findMany({
        where: { awardedAt: null, endsAt: { lt: now } },
        orderBy: { endsAt: "asc" },
        take,
        select: { id: true, slug: true },
    });
}
