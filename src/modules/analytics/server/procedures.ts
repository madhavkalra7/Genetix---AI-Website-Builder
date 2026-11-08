import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
    VISIT_RETENTION_DAYS,
    fillDailySeries,
    rangeStart,
    type DailyPoint,
} from "@/modules/analytics/shared";

const TOP_LIMIT = 8;
const CLEANUP_PROBABILITY = 0.01;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SiteStats {
    published: boolean;
    days: number;
    totalViews: number;
    /**
     * Sum of DAILY unique visitors over the range. visitorHash rotates every UTC day (privacy),
     * so the same person visiting on 3 different days counts as 3.
     */
    uniqueVisitors: number;
    perDay: DailyPoint[];
    topPages: { path: string; views: number }[];
    topCountries: { country: string; views: number }[];
    topReferrers: { host: string; views: number }[];
}

export const analyticsRouter = createTRPCRouter({
    siteStats: protectedProcedure
        .input(
            z.object({
                projectId: z.string().min(1, { message: "Project ID is required" }),
                days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(7),
            })
        )
        .query(async ({ input, ctx }): Promise<SiteStats> => {
            const userId = ctx.auth.userId;
            const project = await prisma.project.findFirst({
                where: { id: input.projectId, userId },
                select: { id: true },
            });
            if (!project) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }

            const site = await prisma.publishedSite.findUnique({
                where: { projectId: project.id },
                select: { id: true, userId: true },
            });

            // Opportunistic retention cleanup (~1% of calls), not awaited.
            if (Math.random() < CLEANUP_PROBABILITY) {
                prisma.siteVisit
                    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - VISIT_RETENTION_DAYS * DAY_MS) } } })
                    .catch((err) => console.error("[analytics] cleanup failed:", err));
            }

            const empty: SiteStats = {
                published: !!site,
                days: input.days,
                totalViews: 0,
                uniqueVisitors: 0,
                perDay: fillDailySeries([], input.days),
                topPages: [],
                topCountries: [],
                topReferrers: [],
            };
            if (!site || site.userId !== userId) return empty;

            const since = rangeStart(input.days);
            const where = { siteId: site.id, createdAt: { gte: since } };

            const [dailyRows, pages, countries, referrers] = await Promise.all([
                prisma.$queryRaw<{ day: string; views: number; visitors: number }[]>(Prisma.sql`
                    SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
                           COUNT(*)::int AS views,
                           COUNT(DISTINCT "visitorHash")::int AS visitors
                    FROM "SiteVisit"
                    WHERE "siteId" = ${site.id} AND "createdAt" >= ${since}
                    GROUP BY 1
                    ORDER BY 1
                `),
                prisma.siteVisit.groupBy({
                    by: ["path"],
                    where,
                    _count: { _all: true },
                    orderBy: { _count: { path: "desc" } },
                    take: TOP_LIMIT,
                }),
                prisma.siteVisit.groupBy({
                    by: ["country"],
                    where: { ...where, country: { not: null } },
                    _count: { _all: true },
                    orderBy: { _count: { country: "desc" } },
                    take: TOP_LIMIT,
                }),
                prisma.siteVisit.groupBy({
                    by: ["referrer"],
                    where: { ...where, referrer: { not: null } },
                    _count: { _all: true },
                    orderBy: { _count: { referrer: "desc" } },
                    take: TOP_LIMIT,
                }),
            ]);

            const perDay = fillDailySeries(
                dailyRows.map((r) => ({ date: r.day, views: Number(r.views), visitors: Number(r.visitors) })),
                input.days
            );

            return {
                published: true,
                days: input.days,
                totalViews: perDay.reduce((sum, d) => sum + d.views, 0),
                uniqueVisitors: perDay.reduce((sum, d) => sum + d.visitors, 0),
                perDay,
                topPages: pages.map((p) => ({ path: p.path, views: p._count._all })),
                topCountries: countries
                    .filter((c) => c.country)
                    .map((c) => ({ country: c.country as string, views: c._count._all })),
                topReferrers: referrers
                    .filter((r) => r.referrer)
                    .map((r) => ({ host: r.referrer as string, views: r._count._all })),
            };
        }),
});
