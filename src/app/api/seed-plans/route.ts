import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plans = [
      {
        name: 'free',
        displayName: 'Free',
        description: 'Perfect for trying out the AI website builder',
        price: 0,
        currency: 'INR',
        interval: 'MONTHLY' as const,
        credits: 100,
        features: {
          maxProjects: 5,
          maxGenerations: 100,
          techStacks: ['html-css-js', 'react-nextjs'],
          support: 'community',
        },
        isActive: true,
      },
      {
        name: 'pro',
        displayName: 'Pro',
        description: 'For professionals and growing teams',
        price: 99,
        currency: 'INR',
        interval: 'MONTHLY' as const,
        credits: 1000,
        features: {
          maxProjects: -1,
          maxGenerations: 1000,
          techStacks: 'all',
          customDomains: true,
          support: 'priority',
          imageCloning: true,
          teamCollaboration: true,
        },
        isActive: true,
      },
      {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'For large teams and organizations',
        price: 699,
        currency: 'INR',
        interval: 'MONTHLY' as const,
        credits: 10000,
        features: {
          maxProjects: -1,
          maxGenerations: 10000,
          techStacks: 'all',
          customDomains: true,
          support: 'dedicated',
          imageCloning: true,
          teamCollaboration: true,
          whiteLabel: true,
          apiAccess: true,
          customAIModels: true,
          sla: true,
        },
        isActive: true,
      },
    ];

    const results = [];
    for (const planData of plans) {
      const plan = await prisma.plan.upsert({
        where: { name: planData.name },
        update: planData,
        create: planData,
      });
      results.push(plan);
    }

    return NextResponse.json({
      success: true,
      message: `✅ Created/Updated ${results.length} plans`,
      plans: results.map(p => ({ id: p.id, name: p.name, displayName: p.displayName, price: p.price })),
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed plans" },
      { status: 500 }
    );
  }
}
