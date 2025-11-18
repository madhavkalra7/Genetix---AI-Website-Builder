import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    // Get user from session
    const session = await getServerSession();
    
    console.log("🔍 Advanced Reasoning Check - Session:", session?.user?.email);
    
    if (!session?.user?.email) {
      console.log("❌ Not authenticated");
      return NextResponse.json({ available: true, hoursRemaining: 0 }); // Allow if not logged in
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      console.log("❌ User not found");
      return NextResponse.json({ available: true, hoursRemaining: 0 });
    }

    console.log("✅ User found:", user.id);

    // Check if user has used Advanced Reasoning in the last 24 hours
    const usage = await prisma.advancedReasoningUsage.findUnique({
      where: { userId: user.id }
    });

    console.log("📊 Usage record:", usage ? `Last used: ${usage.lastUsedAt}` : "Never used");

    if (!usage) {
      // Never used before - available
      console.log("✅ Available - Never used before");
      return NextResponse.json({ available: true, hoursRemaining: 0 });
    }

    const now = new Date();
    const timeSinceLastUse = now.getTime() - usage.lastUsedAt.getTime();
    const hours24 = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    console.log("⏰ Time since last use:", Math.floor(timeSinceLastUse / (60 * 60 * 1000)), "hours");

    if (timeSinceLastUse < hours24) {
      // Still within 24-hour limit
      const hoursRemaining = Math.ceil((hours24 - timeSinceLastUse) / (60 * 60 * 1000));
      console.log("❌ Not available - Hours remaining:", hoursRemaining);
      return NextResponse.json({ 
        available: false, 
        hoursRemaining,
        nextAvailableAt: new Date(usage.lastUsedAt.getTime() + hours24).toISOString()
      });
    }

    // More than 24 hours - available again
    console.log("✅ Available - More than 24 hours passed");
    return NextResponse.json({ available: true, hoursRemaining: 0 });

  } catch (error) {
    console.error("❌ Error checking advanced reasoning availability:", error);
    return NextResponse.json({ available: true, hoursRemaining: 0 }, { status: 500 });
  }
}
