import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { validateSupabaseAnonKey, validateSupabaseUrl } from "@/modules/integrations/shared";

const projectIdSchema = z.string().min(1, { message: "Project ID is required" });

async function assertOwnsProject(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true, supabaseUrl: true, supabaseAnonKey: true },
    });
    if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    return project;
}

/** Validates and normalizes; throws BAD_REQUEST with a user-facing message. */
function parseCredentials(rawUrl: string, rawKey: string) {
    const url = validateSupabaseUrl(rawUrl);
    if (!url.ok) throw new TRPCError({ code: "BAD_REQUEST", message: url.error });
    const key = validateSupabaseAnonKey(rawKey);
    if (!key.ok) throw new TRPCError({ code: "BAD_REQUEST", message: key.error });
    return { url: url.value, anonKey: key.value };
}

const credentialsSchema = z.object({
    url: z.string().max(300),
    anonKey: z.string().max(2000),
});

export const integrationsRouter = createTRPCRouter({
    getSupabase: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .query(async ({ input, ctx }) => {
            const project = await assertOwnsProject(input.projectId, ctx.auth.userId);
            const connected = !!(project.supabaseUrl && project.supabaseAnonKey);
            return {
                connected,
                url: project.supabaseUrl ?? null,
                anonKeyPreview: project.supabaseAnonKey
                    ? `${project.supabaseAnonKey.slice(0, 8)}…`
                    : null,
            };
        }),

    setSupabase: protectedProcedure
        .input(credentialsSchema.extend({ projectId: projectIdSchema }))
        .mutation(async ({ input, ctx }) => {
            await assertOwnsProject(input.projectId, ctx.auth.userId);
            const { url, anonKey } = parseCredentials(input.url, input.anonKey);
            await prisma.project.update({
                where: { id: input.projectId },
                data: { supabaseUrl: url, supabaseAnonKey: anonKey },
            });
            return { connected: true, url, anonKeyPreview: `${anonKey.slice(0, 8)}…` };
        }),

    disconnectSupabase: protectedProcedure
        .input(z.object({ projectId: projectIdSchema }))
        .mutation(async ({ input, ctx }) => {
            await assertOwnsProject(input.projectId, ctx.auth.userId);
            await prisma.project.update({
                where: { id: input.projectId },
                data: { supabaseUrl: null, supabaseAnonKey: null },
            });
            return { connected: false };
        }),

    // Server-side reachability check of the Supabase Auth API with the given anon key.
    testSupabase: protectedProcedure
        .input(credentialsSchema)
        .mutation(async ({ input }) => {
            const { url, anonKey } = parseCredentials(input.url, input.anonKey);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetch(`${url}/auth/v1/settings`, {
                    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
                    signal: controller.signal,
                    redirect: "error",
                    cache: "no-store",
                });
                if (res.ok) return { ok: true as const, message: "Connected to Supabase successfully." };
                if (res.status === 401 || res.status === 403) {
                    return { ok: false as const, message: "Supabase rejected the anon key. Check that it belongs to this project." };
                }
                return { ok: false as const, message: `Supabase responded with HTTP ${res.status}.` };
            } catch (error) {
                const aborted = error instanceof Error && error.name === "AbortError";
                return {
                    ok: false as const,
                    message: aborted
                        ? "Timed out after 5 seconds. Check the project URL."
                        : "Could not reach that URL. Check the project URL.",
                };
            } finally {
                clearTimeout(timer);
            }
        }),
});
