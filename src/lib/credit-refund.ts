import { prisma } from "@/lib/db";
import { refundAiquestIteration } from "@/lib/aiquest";

/**
 * Give back one generation credit (or one AIQuest iteration) to a user.
 * Safe to call from background jobs (no request/cookie access). Never drops below 0.
 */
export async function refundCredit(userId: string, amount = 1): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiquestUserId: true } });
  if (!user) return;
  if (user.aiquestUserId) {
    await refundAiquestIteration(userId);
    return;
  }
  await prisma.userCredits.updateMany({
    where: { userId, creditsUsed: { gte: amount } },
    data: { creditsUsed: { decrement: amount } },
  });
}

/** Resolve the owner of a project / app project (used when only the projectId is known). */
export async function getProjectOwnerId(projectId: string, isApp: boolean): Promise<string | null> {
  if (isApp) {
    const p = await prisma.appProject.findUnique({ where: { id: projectId }, select: { userId: true } });
    return p?.userId ?? null;
  }
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  return p?.userId ?? null;
}
