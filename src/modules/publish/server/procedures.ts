import { randomBytes } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import {
    NOT_PUBLISHABLE_MESSAGE,
    isPublishableTechStack,
    slugifyName,
    validateSlug,
} from "@/modules/publish/shared";
import { GALLERY_TITLE_MAX_LENGTH } from "@/modules/gallery/shared";
import { getPublishedSiteUrl } from "./utils";
import { isPaidUser } from "./plan";

const projectIdSchema = z.string().min(1, { message: "Project ID is required" });

async function getOwnedProject(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true, name: true, techStack: true },
    });
    if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    return project;
}

const randomSuffix = () => randomBytes(4).toString("hex").slice(0, 6);

function generateSlug(projectName: string): string {
    let base = slugifyName(projectName);
    if (base.length < 2) base = "site";
    return `${base}-${randomSuffix()}`;
}

const isUniqueViolation = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const publishRouter = createTRPCRouter({
    get: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .query(async ({ input, ctx }) => {
            await getOwnedProject(input.projectId, ctx.auth.userId);
            const site = await prisma.publishedSite.findUnique({
                where: { projectId: input.projectId },
            });
            if (!site) return null;
            return { ...site, url: getPublishedSiteUrl(site.slug) };
        }),

    /** Whether the current user may hide the "Made with Genetix" badge (paid plans only). */
    badgeAccess: protectedProcedure.query(async ({ ctx }) => ({
        canRemoveBadge: await isPaidUser(ctx.auth.userId),
    })),

    publish: protectedProcedure
        .input(
            z.object({
                projectId: projectIdSchema,
                fragmentId: z.string().min(1).optional(),
                slug: z.string().trim().toLowerCase().optional(),
                /** List the site in the public community gallery (unchanged when omitted). */
                showcase: z.boolean().optional(),
                /** Gallery title (defaults to the project name; unchanged when omitted). */
                title: z
                    .string()
                    .trim()
                    .max(GALLERY_TITLE_MAX_LENGTH, {
                        message: `Title can be at most ${GALLERY_TITLE_MAX_LENGTH} characters`,
                    })
                    .optional(),
                /** Show the "Made with Genetix" badge. Only paid plans may turn it off. */
                showBadge: z.boolean().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const userId = ctx.auth.userId;
            const project = await getOwnedProject(input.projectId, userId);

            if (!isPublishableTechStack(project.techStack)) {
                throw new TRPCError({ code: "BAD_REQUEST", message: NOT_PUBLISHABLE_MESSAGE });
            }

            // The fragment must belong to this project (default: latest one)
            const fragment = await prisma.fragment.findFirst({
                where: input.fragmentId
                    ? { id: input.fragmentId, message: { projectId: project.id } }
                    : { message: { projectId: project.id } },
                orderBy: { createdAt: "desc" },
                select: { id: true, files: true },
            });
            if (!fragment) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: input.fragmentId
                        ? "Version not found"
                        : "Nothing to publish yet. Generate your site first.",
                });
            }
            const files = fragment.files as Record<string, unknown> | null;
            const hasIndex =
                !!files &&
                typeof files === "object" &&
                Object.keys(files).some((k) =>
                    /^(?:\.?\/)?(?:home\/user\/)?index\.html$/.test(k.replace(/^\/+/, ""))
                );
            if (!hasIndex) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "This version has no index.html, so it can't be published.",
                });
            }

            const existing = await prisma.publishedSite.findUnique({
                where: { projectId: project.id },
                select: { slug: true, title: true },
            });

            // Empty title -> project name. Keep the stored title when the caller doesn't send one.
            const title =
                input.title !== undefined
                    ? input.title || project.name.slice(0, GALLERY_TITLE_MAX_LENGTH)
                    : (existing?.title ?? project.name.slice(0, GALLERY_TITLE_MAX_LENGTH));
            const showcaseData = input.showcase !== undefined ? { showcase: input.showcase } : {};
            // Free plans always show the badge (also re-enabled on republish after a downgrade).
            const paid = await isPaidUser(userId);
            const badgeData = !paid
                ? { showBadge: true }
                : input.showBadge !== undefined
                  ? { showBadge: input.showBadge }
                  : {};

            const requestedSlug = input.slug || undefined;
            let slug = requestedSlug ?? existing?.slug ?? generateSlug(project.name);
            const slugError = validateSlug(slug);
            if (slugError) {
                throw new TRPCError({ code: "BAD_REQUEST", message: slugError });
            }

            // Retry auto-generated slugs on the (unlikely) collision; explicit slugs conflict.
            for (let attempt = 0; attempt < 5; attempt++) {
                const owner = await prisma.publishedSite.findUnique({
                    where: { slug },
                    select: { projectId: true },
                });
                if (owner && owner.projectId !== project.id) {
                    if (requestedSlug || existing) {
                        throw new TRPCError({
                            code: "CONFLICT",
                            message: `The address "${slug}" is already taken. Please choose another one.`,
                        });
                    }
                    slug = generateSlug(project.name);
                    continue;
                }
                try {
                    const site = await prisma.publishedSite.upsert({
                        where: { projectId: project.id },
                        create: {
                            projectId: project.id,
                            slug,
                            fragmentId: fragment.id,
                            userId,
                            title,
                            ...showcaseData,
                            ...badgeData,
                        },
                        update: { slug, fragmentId: fragment.id, title, ...showcaseData, ...badgeData },
                    });
                    return {
                        slug: site.slug,
                        url: getPublishedSiteUrl(site.slug),
                        showcase: site.showcase,
                        title: site.title,
                        showBadge: site.showBadge,
                    };
                } catch (error) {
                    if (!isUniqueViolation(error)) throw error;
                    if (requestedSlug || existing) {
                        throw new TRPCError({
                            code: "CONFLICT",
                            message: `The address "${slug}" is already taken. Please choose another one.`,
                        });
                    }
                    slug = generateSlug(project.name);
                }
            }
            throw new TRPCError({
                code: "CONFLICT",
                message: "Could not find a free address. Please enter one manually.",
            });
        }),

    unpublish: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .mutation(async ({ input, ctx }) => {
            await getOwnedProject(input.projectId, ctx.auth.userId);
            const { count } = await prisma.publishedSite.deleteMany({
                where: { projectId: input.projectId },
            });
            return { unpublished: count > 0 };
        }),
});
