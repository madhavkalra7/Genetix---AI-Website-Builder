import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function fixCredits() {
  console.log('🔧 Fixing user credits...');

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: 'madhavkalra118@gmail.com' },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
      credits: true,
    },
  });

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log('✅ User found:', user.email);
  console.log('📊 Current subscription:', user.subscription?.plan?.name);
  console.log('💰 Current credits:', user.credits);

  // Get plan credits
  const planCredits = user.subscription?.plan?.credits || 3;

  // Update or create credits
  const updatedCredits = await prisma.userCredits.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      creditsUsed: 0,
      creditsLimit: planCredits,
      lastReset: new Date(),
    },
    update: {
      creditsUsed: 0,
      creditsLimit: planCredits,
      lastReset: new Date(),
    },
  });

  console.log('✅ Credits updated:', updatedCredits);
  console.log('🎉 Fix complete!');
}

fixCredits()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
