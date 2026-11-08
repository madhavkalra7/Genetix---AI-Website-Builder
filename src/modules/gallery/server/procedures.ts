import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { getPublishedSiteUrl } from "@/modules/publish/server/utils";
import {
    GALLERY_PAGE_SIZE_MAX,
    GALLERY_TITLE_MAX_LENGTH,
    REMIX_RATE_LIMIT,
} from "@/modules/gallery/shared";

const truncate = (value: string, max: number) =>
    value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

/** Public display name: first name, else username — never the email address. */
const displayName = (user: { firstName: string | null; username: string | null } | undefined) =>
    user?.firstName?.trim() || user?.username?.trim() || "Genetix creator";

export const galleryRouter = createTRPCRouter({
    list: baseProcedure
        .input(
            z.object({
                cursor: z.string().min(1).nullish(),
                limit: z.number().int().min(1).max(GALLERY_PAGE_SIZE_MAX).default(12),
                q: z.string().trim().max(100).optional(),
            })
        )
        .query(async ({ input }) => {
            const where: Prisma.PublishedSiteWhereInput = { showcase: true };
            if (input.q) {
                where.title = { contains: input.q, mode: "insensitive" };
            }

            const sites = await prisma.publishedSite.findMany({
                where,
                orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
                take: input.limit + 1,
                ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    projectId: true,
                    userId: true,
                    remixCount: true,
                    updatedAt: true,
                },
            });

            const hasMore = sites.length > input.limit;
            const page = hasMore ? sites.slice(0, input.limit) : sites;

            const [projects, users] = await Promise.all([
                prisma.project.findMany({
                    where: { id: { in: page.map((s) => s.projectId) } },
                    select: { id: true, name: true, techStack: true },
                }),
                prisma.user.findMany({
                    where: { id: { in: [...new Set(page.map((s) => s.userId))] } },
                    select: { id: true, firstName: true, username: true },
                }),
            ]);
            const projectById = new Map(projects.map((p) => [p.id, p]));
            const userById = new Map(users.map((u) => [u.id, u]));

            const items = page.flatMap((site) => {
                const project = projectById.get(site.projectId);
                // Orphaned rows (project deleted) are hidden from the gallery.
                if (!project) return [];
                return [
                    {
                        slug: site.slug,
                        title: site.title?.trim() || project.name,
                        url: getPublishedSiteUrl(site.slug),
                        techStack: project.techStack,
                        remixCount: site.remixCount,
                        updatedAt: site.updatedAt,
                        author: displayName(userById.get(site.userId)),
                    },
                ];
            });

            return {
                items,
                nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
            };
        }),

    remix: protectedProcedure
        .input(z.object({ slug: z.string().trim().toLowerCase().min(1).max(100) }))
        .mutation(async ({ input, ctx }) => {
            const userId = ctx.auth.userId;

            const site = await prisma.publishedSite.findUnique({
                where: { slug: input.slug },
                select: {
                    id: true,
                    showcase: true,
                    title: true,
                    projectId: true,
                    fragmentId: true,
                    updatedAt: true,
                },
            });
            if (!site || !site.showcase) {
                throw new TRPCError({ code: "NOT_FOUND", message: "This site isn't in the community gallery" });
            }

            const [project, fragment] = await Promise.all([
                prisma.project.findUnique({
                    where: { id: site.projectId },
                    select: { name: true, techStack: true },
                }),
                prisma.fragment.findFirst({
                    where: { id: site.fragmentId, message: { projectId: site.projectId } },
                    select: { title: true, files: true, sandboxUrl: true },
                }),
            ]);
            if (!project || !fragment) {
                throw new TRPCError({ code: "NOT_FOUND", message: "This site is no longer available" });
            }

            const rate = await checkRateLimit(`remix:${userId}`, REMIX_RATE_LIMIT.limit, REMIX_RATE_LIMIT.windowMs);
            if (!rate.ok) {
                const minutes = Math.max(1, Math.ceil(rate.retryAfterSec / 60));
                throw new TRPCError({
                    code: "TOO_MANY_REQUESTS",
                    message: `You've remixed a lot recently — try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
                });
            }

            const title = site.title?.trim() || project.name;
            const now = Date.now();

            const created = await prisma.$transaction(async (tx) => {
                const newProject = await tx.project.create({
                    data: {
                        userId,
                        name: truncate(`Remix of ${title}`, GALLERY_TITLE_MAX_LENGTH),
                        techStack: project.techStack,
                        messages: {
                            create: [
                                {
                                    role: "USER",
                                    type: "RESULT",
                                    content: `Remixed from ${title}`,
                                    createdAt: new Date(now),
                                    updatedAt: new Date(now),
                                },
                                {
                                    role: "ASSISTANT",
                                    type: "RESULT",
                                    content: `Here's your copy of ${title} — ask me to change anything.`,
                                    createdAt: new Date(now + 1),
                                    updatedAt: new Date(now + 1),
                                    fragments: {
                                        create: {
                                            title: fragment.title,
                                            sandboxUrl: fragment.sandboxUrl,
                                            files: (fragment.files ?? {}) as Prisma.InputJsonValue,
                                        },
                                    },
                                },
                            ],
                        },
                    },
                    select: { id: true },
                });
                // Keep updatedAt unchanged so a remix doesn't bump the site to the top of the gallery.
                await tx.publishedSite.update({
                    where: { id: site.id },
                    data: { remixCount: { increment: 1 }, updatedAt: site.updatedAt },
                });
                return newProject;
            });

            return { projectId: created.id };
        }),
});
