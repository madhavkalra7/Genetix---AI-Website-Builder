import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { SHARE_ID_ALPHABET, SHARE_ID_LENGTH, SHARE_ID_PATTERN, sharePath } from "@/modules/share/shared";

const normalizeBaseUrl = (value: string | undefined) => value?.trim().replace(/\/+$/, "") || "";

export const getAppBaseUrl = () =>
    normalizeBaseUrl(process.env.APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ||
    "http://localhost:3000";

export const getShareUrl = (shareId: string) => `${getAppBaseUrl()}${sharePath(shareId)}`;

/** Unbiased random id from SHARE_ID_ALPHABET (rejection sampling over random bytes). */
export function generateShareId(length = SHARE_ID_LENGTH): string {
    const alphabet = SHARE_ID_ALPHABET;
    const max = Math.floor(256 / alphabet.length) * alphabet.length;
    let out = "";
    while (out.length < length) {
        for (const byte of randomBytes(length * 2)) {
            if (byte < max) out += alphabet[byte % alphabet.length];
            if (out.length === length) break;
        }
    }
    return out;
}

export const isValidShareId = (shareId: string) => SHARE_ID_PATTERN.test(shareId);

/** Public display name: first name, else username — never the email address. */
export const shareAuthorName = (user: { firstName: string | null; username: string | null } | null | undefined) =>
    user?.firstName?.trim() || user?.username?.trim() || "a Genetix creator";

/** Lightweight lookup (no files) for metadata / OG images. Null when missing or sharing is off. */
export async function getSharedProjectSummary(shareId: string) {
    if (!isValidShareId(shareId)) return null;
    const project = await prisma.project.findUnique({
        where: { shareId },
        select: {
            id: true,
            name: true,
            techStack: true,
            shareEnabled: true,
            updatedAt: true,
            user: { select: { firstName: true, username: true } },
        },
    });
    if (!project || !project.shareEnabled) return null;
    return {
        projectId: project.id,
        projectName: project.name,
        techStack: project.techStack,
        author: shareAuthorName(project.user),
        updatedAt: project.updatedAt,
    };
}

/** Latest ASSISTANT message that produced a fragment (= the current version of the project). */
export async function getLatestFragment(projectId: string) {
    const message = await prisma.message.findFirst({
        where: { projectId, role: "ASSISTANT", fragments: { isNot: null } },
        orderBy: { createdAt: "desc" },
        select: {
            fragments: { select: { title: true, files: true, sandboxUrl: true, updatedAt: true } },
        },
    });
    return message?.fragments ?? null;
}

/** Normalises a fragment's JSON files column into a path -> contents map (strings only). */
export function toFilesMap(files: unknown): Record<string, string> {
    if (!files || typeof files !== "object" || Array.isArray(files)) return {};
    const out: Record<string, string> = {};
    for (const [path, contents] of Object.entries(files as Record<string, unknown>)) {
        if (typeof contents === "string") out[path] = contents;
    }
    return out;
}

/** Everything the public share page needs. Null when the link is missing or disabled. */
export async function getSharedProjectView(shareId: string) {
    const summary = await getSharedProjectSummary(shareId);
    if (!summary) return null;
    const fragment = await getLatestFragment(summary.projectId);
    return {
        shareId,
        projectName: summary.projectName,
        techStack: summary.techStack,
        author: summary.author,
        files: fragment ? toFilesMap(fragment.files) : {},
        hasVersion: !!fragment,
        versionTitle: fragment?.title ?? null,
        updatedAt: fragment?.updatedAt ?? summary.updatedAt,
    };
}

export type SharedProjectView = NonNullable<Awaited<ReturnType<typeof getSharedProjectView>>>;
