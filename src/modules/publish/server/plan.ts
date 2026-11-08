import "server-only";
import { prisma } from "@/lib/db";

/**
 * True when the user has an ACTIVE, unexpired subscription to a plan other than "free".
 * (Free users get a "free" plan subscription at signup; users without any subscription are free too.)
 */
export async function isPaidUser(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } },
    });
    if (!subscription) return false;
    return (
        subscription.status === "ACTIVE" &&
        subscription.currentPeriodEnd.getTime() >= Date.now() &&
        subscription.plan.name.toLowerCase() !== "free"
    );
}
