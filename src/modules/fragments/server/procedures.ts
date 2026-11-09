import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { unifiedDiff } from "@/lib/text-diff";
import { replaceTextInFiles } from "@/lib/text-replace";

// ~2MB of text per file is plenty for hand edits and keeps the JSON column sane
const MAX_FILE_CONTENT_LENGTH = 2 * 1024 * 1024;

const filePathSchema = z
    .string()
    .trim()
    .min(1, { message: "File path is required" })
    .max(300, { message: "File path is too long" })
    .refine((p) => !p.split(/[\/]/).includes(".."), {
        message: "File path must not contain '..'",
    })
    .refine((p) => !p.includes("\0"), { message: "Invalid file path" });

const MAX_TITLE_LENGTH = 60;
const MAX_PROJECT_NAME_LENGTH = 60;
// A build older than this is considered dead (crashed run that never finished)
const BUILD_STALE_MS = 20 * 60 * 1000;

const truncate = (text: string, max: number) =>
    text.length <= max ? text : text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";

const asFileMap = (files: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!files || typeof files !== "object" || Array.isArray(files)) return out;
    for (const [key, value] of Object.entries(files as Record<string, unknown>)) {
        if (typeof value === "string") out[key] = value;
    }
    return out;
};

const isDataUrl = (content: string) => /^data:[^,]{0,200},/i.test(content.slice(0, 220));

/**
 * True while a code-agent run is in flight for this (website) project: either a Build row
 * is still "running" or the last message is a USER message waiting for its reply.
 * Inserting an ASSISTANT message then would make the chat look finished mid-build.
 */
async function isProjectBuilding(projectId: string): Promise<boolean> {
    const since = new Date(Date.now() - BUILD_STALE_MS);
    const [running, last] = await Promise.all([
        prisma.build.findFirst({
            where: { projectId, isApp: false, status: "running", startedAt: { gte: since } },
            select: { id: true },
        }),
        prisma.message.findFirst({
            where: { projectId },
            orderBy: { updatedAt: "desc" },
            select: { role: true, createdAt: true },
        }),
    ]);
    if (running) return true;
    return !!last && last.role === "USER" && last.createdAt >= since;
}

// ---------------------------------------------------------------------------
// Visual edits: zero-token CSS overrides for one element, kept in a marked block
// ---------------------------------------------------------------------------

const VISUAL_START = "/* genetix:visual-edits:start */";
const VISUAL_END = "/* genetix:visual-edits:end */";

const COLOR_RE =
    /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}(?:\.\d+)?%?\s*(?:,\s*\d{1,3}(?:\.\d+)?%?\s*){2}(?:,\s*(?:0|1|0?\.\d+|\d{1,3}%)\s*)?\)|[a-z]{3,20})$/i;
const pxRe = (max: number) => (v: string) => {
    if (!/^\d{1,4}(?:\.\d{1,2})?px$/.test(v)) return false;
    const n = parseFloat(v);
    return n >= 0 && n <= max;
};

/** Whitelisted properties and their value validators ("" always means "remove") */
const VISUAL_PROPERTIES: Record<string, (v: string) => boolean> = {
    color: (v) => COLOR_RE.test(v),
    "background-color": (v) => COLOR_RE.test(v),
    "font-size": (v) => pxRe(400)(v) && parseFloat(v) >= 1,
    "font-weight": (v) => /^(?:normal|bold|lighter|bolder|[1-9]00)$/.test(v),
    padding: pxRe(500),
    "border-radius": pxRe(9999),
    "text-align": (v) => /^(?:left|right|center|justify|start|end)$/.test(v),
    opacity: (v) => /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|\.\d{1,3})$/.test(v),
    display: (v) => v === "none",
};

const visualSelectorSchema = z
    .string()
    .trim()
    .min(1, { message: "Selector is required" })
    .max(500, { message: "Selector is too long" })
    .refine((s) => !/[{}<;\n\r]|\/\*|\*\//.test(s), { message: "Invalid selector" });

const visualStylesSchema = z
    .record(z.string(), z.string().trim().max(100))
    .superRefine((styles, ctx) => {
        const entries = Object.entries(styles);
        if (entries.length === 0) {
            ctx.addIssue({ code: "custom", message: "No style changes" });
        }
        for (const [prop, value] of entries) {
            const validate = VISUAL_PROPERTIES[prop];
            if (!validate) {
                ctx.addIssue({ code: "custom", message: `Unsupported property: ${prop}` });
            } else if (value !== "" && !validate(value)) {
                ctx.addIssue({ code: "custom", message: `Invalid value for ${prop}` });
            }
        }
    });

type VisualRules = Map<string, Map<string, string>>;

function parseVisualRules(block: string): VisualRules {
    const rules: VisualRules = new Map();
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) {
        const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
        if (!selector) continue;
        const decls = rules.get(selector) ?? new Map<string, string>();
        for (const decl of m[2].split(";")) {
            const i = decl.indexOf(":");
            if (i === -1) continue;
            const prop = decl.slice(0, i).trim().toLowerCase();
            const value = decl.slice(i + 1).replace(/!important/i, "").trim();
            if (prop && value) decls.set(prop, value);
        }
        rules.set(selector, decls);
    }
    return rules;
}

function serializeVisualRules(rules: VisualRules): string {
    const body = Array.from(rules.entries())
        .filter(([, decls]) => decls.size > 0)
        .map(([selector, decls]) => {
            const lines = Array.from(decls.entries()).map(([p, v]) => `  ${p}: ${v} !important;`);
            return `${selector} {\n${lines.join("\n")}\n}`;
        });
    return body.length ? `${VISUAL_START}\n${body.join("\n")}\n${VISUAL_END}` : "";
}

/** Merge `styles` for `selector` into the marked block of `css` (creating/removing the block as needed). */
export function upsertVisualRule(css: string, selector: string, styles: Record<string, string>): string {
    const start = css.indexOf(VISUAL_START);
    const end = start === -1 ? -1 : css.indexOf(VISUAL_END, start);
    const hasBlock = start !== -1 && end !== -1;
    const rules = hasBlock ? parseVisualRules(css.slice(start + VISUAL_START.length, end)) : new Map();

    const decls = rules.get(selector) ?? new Map<string, string>();
    for (const [prop, value] of Object.entries(styles)) {
        if (value === "") decls.delete(prop);
        else decls.set(prop, value);
    }
    rules.delete(selector); // re-insert last so the newest rule wins on equal specificity
    rules.set(selector, decls);

    const block = serializeVisualRules(rules);
    if (hasBlock) {
        const before = css.slice(0, start).replace(/\s+$/, "");
        const after = css.slice(end + VISUAL_END.length).replace(/^\s+/, "");
        return [before, block, after].filter(Boolean).join("\n\n") + "\n";
    }
    if (!block) return css;
    return `${css.replace(/\s+$/, "")}\n\n${block}\n`;
}

const STYLE_BLOCK_RE = /<style\b[^>]*data-genetix-visual-edits[^>]*>([\s\S]*?)<\/style>/i;

/** Apply the rule to the project's files: main stylesheet, else a <style> block in index.html */
function applyVisualRuleToFiles(
    files: Record<string, string>,
    selector: string,
    styles: Record<string, string>,
): Record<string, string> | null {
    const keys = Object.keys(files);
    const base = (k: string) => k.split("/").pop() ?? k;
    const cssKey =
        keys.find((k) => base(k) === "style.css" && !isDataUrl(files[k])) ??
        keys.find((k) => k.toLowerCase().endsWith(".css") && !isDataUrl(files[k]));
    if (cssKey) {
        return { ...files, [cssKey]: upsertVisualRule(files[cssKey], selector, styles) };
    }

    const htmlKey = ["index.html", "/home/user/index.html", "/index.html"].find((k) => typeof files[k] === "string");
    if (!htmlKey) return null;
    const html = files[htmlKey];
    const existing = STYLE_BLOCK_RE.exec(html);
    const css = upsertVisualRule(existing ? existing[1] : "", selector, styles).trim();
    const tag = `<style data-genetix-visual-edits>\n${css}\n</style>`;
    let next: string;
    if (existing) {
        next = html.slice(0, existing.index) + tag + html.slice(existing.index + existing[0].length);
    } else {
        const close = html.toLowerCase().lastIndexOf("</head>");
        next = close === -1 ? tag + "\n" + html : html.slice(0, close) + tag + "\n" + html.slice(close);
    }
    return { ...files, [htmlKey]: next };
}

export type FileChange = {
    path: string;
    status: "added" | "removed" | "modified" | "unchanged";
    /** Unified diff lines (" ", "-", "+" prefixed; "@@" hunk headers). Absent when too large/binary. */
    diff?: string[];
    /** Why no line diff is provided for a changed file */
    note?: string;
};

export const fragmentsRouter = createTRPCRouter({
    // Files of one fragment, for the full-screen preview page (owner only)
    getFiles: protectedProcedure
        .input(z.object({ fragmentId: z.string().min(1) }))
        .query(async ({ input, ctx }) => {
            const fragment = await prisma.fragment.findFirst({
                where: {
                    id: input.fragmentId,
                    message: { project: { userId: ctx.auth.userId } },
                },
                select: { files: true, title: true },
            });
            if (!fragment || !fragment.files || typeof fragment.files !== "object") {
                throw new TRPCError({ code: "NOT_FOUND", message: "Preview not found" });
            }
            return { title: fragment.title, files: fragment.files as Record<string, string> };
        }),

    updateFile: protectedProcedure
        .input(
            z.object({
                fragmentId: z.string().min(1, { message: "Fragment ID is required" }),
                path: filePathSchema,
                content: z
                    .string()
                    .max(MAX_FILE_CONTENT_LENGTH, { message: "File is too large (max 2MB)" }),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            return prisma.$transaction(async (tx) => {
                // Ownership: Fragment -> Message -> Project.userId must be the caller
                const fragment = await tx.fragment.findFirst({
                    where: {
                        id: input.fragmentId,
                        message: { project: { userId: ctx.auth.userId } },
                    },
                    select: { id: true, files: true, title: true, sandboxUrl: true, message: { select: { projectId: true } } },
                });

                if (!fragment) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
                }

                // The AI always builds on the NEWEST version. If the user edited an older version,
                // save the edit as a new latest version so the next build includes it.
                const projectId = fragment.message.projectId;
                const newest = await tx.fragment.findFirst({
                    where: { message: { projectId } },
                    orderBy: { createdAt: "desc" },
                    select: { id: true },
                });
                if (newest && newest.id !== fragment.id) {
                    const files = { ...asFileMap(fragment.files), [input.path]: input.content };
                    const message = await tx.message.create({
                        data: {
                            projectId,
                            role: "ASSISTANT",
                            type: "RESULT",
                            content: `Saved your edit to ${truncate(input.path, 120)} as a new version (based on "${truncate(fragment.title, 60)}").`,
                            fragments: {
                                create: {
                                    title: truncate(`Edited ${input.path.split("/").pop() || input.path}`, MAX_TITLE_LENGTH),
                                    sandboxUrl: fragment.sandboxUrl,
                                    files: files as Prisma.InputJsonValue,
                                },
                            },
                        },
                        include: { fragments: true },
                    });
                    await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
                    if (!message.fragments) {
                        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the edit" });
                    }
                    return message.fragments;
                }

                // Atomic single-key update inside the jsonb column: two concurrent saves to
                // different files can no longer overwrite each other (no read-modify-write).
                // updatedAt is stored as UTC "timestamp without time zone" by Prisma.
                await tx.$executeRaw`
                    UPDATE "Fragment"
                    SET "files" = jsonb_set(
                            CASE WHEN jsonb_typeof("files") = 'object' THEN "files" ELSE '{}'::jsonb END,
                            ARRAY[${input.path}]::text[],
                            to_jsonb(${input.content}::text),
                            true
                        ),
                        "updatedAt" = (NOW() AT TIME ZONE 'UTC')
                    WHERE "id" = ${fragment.id}`;

                const updated = await tx.fragment.findUnique({ where: { id: fragment.id } });
                if (!updated) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
                }
                return updated;
            });
        }),

    // Restore an older version as the newest one (no credits; no AI run)
    restore: protectedProcedure
        .input(z.object({ fragmentId: z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
            const source = await prisma.fragment.findFirst({
                where: {
                    id: input.fragmentId,
                    message: { project: { userId: ctx.auth.userId } },
                },
                select: {
                    files: true,
                    title: true,
                    sandboxUrl: true,
                    message: { select: { projectId: true } },
                },
            });
            if (!source) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
            }
            const projectId = source.message.projectId;

            if (await isProjectBuilding(projectId)) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Please wait for the current build to finish before restoring a version",
                });
            }

            const baseTitle = source.title.replace(/^Restored:\s*/i, "");
            const title = truncate(`Restored: ${baseTitle}`, MAX_TITLE_LENGTH);

            return prisma.$transaction(async (tx) => {
                const message = await tx.message.create({
                    data: {
                        projectId,
                        role: "ASSISTANT",
                        type: "RESULT",
                        content: `Restored version "${source.title}"`,
                        fragments: {
                            create: {
                                title,
                                sandboxUrl: source.sandboxUrl,
                                files: (source.files ?? {}) as Prisma.InputJsonValue,
                            },
                        },
                    },
                    include: { fragments: true },
                });
                await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
                if (!message.fragments) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not restore this version" });
                }
                return message.fragments;
            });
        }),

    // Visual edit: style one element with a CSS override, as a new version (no credits; no AI run)
    applyVisualEdit: protectedProcedure
        .input(
            z
                .object({
                    fragmentId: z.string().min(1),
                    selector: visualSelectorSchema,
                    styles: visualStylesSchema.optional(),
                    // Direct text change: replaced in the source when it can be found exactly once
                    text: z
                        .object({ from: z.string().trim().min(1).max(2000), to: z.string().trim().min(1).max(2000) })
                        .optional(),
                })
                .refine((v) => !!v.styles || !!v.text, { message: "Nothing to save" }),
        )
        .mutation(async ({ input, ctx }) => {
            const source = await prisma.fragment.findFirst({
                where: {
                    id: input.fragmentId,
                    message: { project: { userId: ctx.auth.userId } },
                },
                select: { files: true, sandboxUrl: true, message: { select: { projectId: true } } },
            });
            if (!source) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
            }
            const projectId = source.message.projectId;

            if (await isProjectBuilding(projectId)) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Please wait for the current build to finish before saving visual edits",
                });
            }

            // Edits apply to the version the user is looking at (selectors/text come from it);
            // the result becomes the newest version, so the next AI build includes it.
            const latest = source;

            let files: Record<string, string> = asFileMap(latest.files);
            if (input.styles) {
                const styled = applyVisualRuleToFiles(files, input.selector, input.styles);
                if (!styled) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Visual edits need a stylesheet or index.html" });
                }
                files = styled;
            }
            // Text: deterministic replacement (free, instant). If it can't be located exactly once,
            // report it so the client can fall back to a quick AI edit.
            let textApplied = false;
            let textFailure: "empty" | "not-found" | "ambiguous" | null = null;
            if (input.text) {
                const replaced = replaceTextInFiles(files, input.text.from, input.text.to);
                if (replaced.ok) {
                    files = replaced.files;
                    textApplied = true;
                } else {
                    textFailure = replaced.reason;
                }
            }
            if (!input.styles && !textApplied) {
                // Nothing could be saved deterministically; no new version
                return { fragment: null, textApplied: false, textFailure };
            }

            const selectorLabel = truncate(input.selector, 200);
            return prisma.$transaction(async (tx) => {
                const message = await tx.message.create({
                    data: {
                        projectId,
                        role: "ASSISTANT",
                        type: "RESULT",
                        content: textApplied && input.text
                            ? `Changed text to "${truncate(input.text.to, 80)}"${input.styles ? ` and applied visual edits to ${selectorLabel}` : ""}`
                            : `Applied visual edits to ${selectorLabel}`,
                        fragments: {
                            create: {
                                title: textApplied && !input.styles ? "Text edit" : "Visual edit",
                                sandboxUrl: latest.sandboxUrl,
                                files: files as Prisma.InputJsonValue,
                            },
                        },
                    },
                    include: { fragments: true },
                });
                await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
                if (!message.fragments) {
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save visual edits" });
                }
                return { fragment: message.fragments, textApplied, textFailure };
            });
        }),

    // Copy a project (its latest version) into a brand new project
    duplicateProject: protectedProcedure
        .input(z.object({ projectId: z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
            const project = await prisma.project.findFirst({
                where: { id: input.projectId, userId: ctx.auth.userId },
                select: { id: true, name: true, techStack: true, supabaseUrl: true, supabaseAnonKey: true },
            });
            if (!project) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }

            const latest = await prisma.fragment.findFirst({
                where: { message: { projectId: project.id, role: "ASSISTANT", type: "RESULT" } },
                orderBy: { createdAt: "desc" },
                select: { files: true, title: true, sandboxUrl: true },
            });
            if (!latest) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "This project has no version to duplicate yet" });
            }

            const suffix = " (copy)";
            const name = truncate(project.name, MAX_PROJECT_NAME_LENGTH - suffix.length) + suffix;

            const created = await prisma.$transaction(async (tx) => {
                const newProject = await tx.project.create({
                    data: {
                        name,
                        userId: ctx.auth.userId,
                        techStack: project.techStack,
                        advancedReasoning: false,
                        supabaseUrl: project.supabaseUrl,
                        supabaseAnonKey: project.supabaseAnonKey,
                    },
                    select: { id: true },
                });
                // Explicit, strictly increasing timestamps: the chat is ordered by updatedAt
                const now = Date.now();
                await tx.message.create({
                    data: {
                        projectId: newProject.id,
                        role: "USER",
                        type: "RESULT",
                        content: `Duplicated from ${project.name}`,
                        createdAt: new Date(now),
                        updatedAt: new Date(now),
                    },
                });
                await tx.message.create({
                    data: {
                        projectId: newProject.id,
                        role: "ASSISTANT",
                        type: "RESULT",
                        content: `Copied the latest version "${latest.title}"`,
                        createdAt: new Date(now + 1),
                        updatedAt: new Date(now + 1),
                        fragments: {
                            create: {
                                title: truncate(latest.title, MAX_TITLE_LENGTH),
                                sandboxUrl: latest.sandboxUrl,
                                files: (latest.files ?? {}) as Prisma.InputJsonValue,
                            },
                        },
                    },
                });
                return newProject;
            });

            return { id: created.id };
        }),

    // Per-file changes between two versions (line diff computed server-side)
    compare: protectedProcedure
        .input(z.object({ fromFragmentId: z.string().min(1), toFragmentId: z.string().min(1) }))
        .query(async ({ input, ctx }) => {
            const owned = { message: { project: { userId: ctx.auth.userId } } };
            const select = { id: true, title: true, files: true, createdAt: true } as const;
            const [from, to] = await Promise.all([
                prisma.fragment.findFirst({ where: { id: input.fromFragmentId, ...owned }, select }),
                prisma.fragment.findFirst({ where: { id: input.toFragmentId, ...owned }, select }),
            ]);
            if (!from || !to) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
            }

            const before = asFileMap(from.files);
            const after = asFileMap(to.files);
            const paths = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

            const files: FileChange[] = paths.map((path): FileChange => {
                const a = before[path];
                const b = after[path];
                const binary = (a !== undefined && isDataUrl(a)) || (b !== undefined && isDataUrl(b));

                if (a === undefined || b === undefined) {
                    const status = a === undefined ? "added" : "removed";
                    if (binary) return { path, status, note: "Image file" };
                    const diff = a === undefined ? unifiedDiff("", b ?? "") : unifiedDiff(a, "");
                    return diff ? { path, status, diff } : { path, status, note: "File too large to show" };
                }
                if (a === b) return { path, status: "unchanged" };
                if (binary) return { path, status: "modified", note: "Image file" };
                const diff = unifiedDiff(a, b);
                return diff
                    ? { path, status: "modified", diff }
                    : { path, status: "modified", note: "File too large to show" };
            });

            return {
                from: { id: from.id, title: from.title, createdAt: from.createdAt },
                to: { id: to.id, title: to.title, createdAt: to.createdAt },
                files,
            };
        }),
});
