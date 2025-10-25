import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create billing plans
  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      description: 'Perfect for trying out the AI website builder',
      price: 0,
      currency: 'USD',
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
      price: 19,
      currency: 'USD',
      interval: 'MONTHLY' as const,
      credits: 1000,
      features: {
        maxProjects: -1, // unlimited
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
      price: 99,
      currency: 'USD',
      interval: 'MONTHLY' as const,
      credits: 10000,
      features: {
        maxProjects: -1, // unlimited
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

  for (const planData of plans) {
    const plan = await prisma.plan.upsert({
      where: { name: planData.name },
      update: planData,
      create: planData,
    });
    console.log(`✅ Created/Updated plan: ${plan.displayName}`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
