import { getBuildOwnerId } from "@/lib/credits";

/**
 * @deprecated Credits are now charged only when a build succeeds (see src/lib/credits.ts), so
 * there is never anything to refund. Kept as a no-op so stale callers can't mint free credits.
 */
export async function refundCredit(userId: string, amount = 1): Promise<void> {
  void userId;
  void amount;
}

/** Resolve the owner of a project / app project (used when only the projectId is known). */
export async function getProjectOwnerId(projectId: string, isApp: boolean): Promise<string | null> {
  return getBuildOwnerId(projectId, isApp);
}
