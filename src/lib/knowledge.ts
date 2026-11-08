// Knowledge: the user's standing instructions (Workspace = all their projects, Project = this one).
// Injected into full builds, quick edits and plan chats so every change follows them.

import { prisma } from "@/lib/db";

export interface KnowledgeSources {
  workspace?: string | null;
  project?: string | null;
}

const MAX_KNOWLEDGE_CHARS = 4000;

export function formatKnowledgeBlock(k: KnowledgeSources | null | undefined): string {
  const workspace = k?.workspace?.trim().slice(0, MAX_KNOWLEDGE_CHARS);
  const project = k?.project?.trim().slice(0, MAX_KNOWLEDGE_CHARS);
  if (!workspace && !project) return "";
  return [
    "=== KNOWLEDGE (the user's standing instructions — follow them on every change; the request below wins only where it explicitly says otherwise) ===",
    workspace ? `WORKSPACE (applies to all of this user's projects):\n${workspace}` : "",
    project ? `THIS PROJECT:\n${project}` : "",
    "=== END KNOWLEDGE ===",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Load both knowledge levels for a (website) project. Never throws. */
export async function loadProjectKnowledge(projectId: string): Promise<KnowledgeSources> {
  try {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: { knowledge: true, user: { select: { knowledge: true } } },
    });
    return { project: p?.knowledge ?? null, workspace: p?.user?.knowledge ?? null };
  } catch {
    return {};
  }
}
