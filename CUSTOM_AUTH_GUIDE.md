# Custom Authentication & Billing Implementation Guide

## 🎯 Overview
This guide explains the custom authentication and billing system that replaces Clerk with a self-hosted solution matching your cosmic theme.

## 📋 What We've Created

### 1. **Database Schema** (schema.prisma)
- ✅ User model with email/password authentication
- ✅ Session management system
- ✅ Email verification tokens
- ✅ Password reset functionality
- ✅ Subscription & billing models
- ✅ Payment tracking
- ✅ Plan management

### 2. **Authentication Backend** (src/lib/auth.ts)
- ✅ Password hashing with bcrypt
- ✅ Session token generation
- ✅ Session validation
- ✅ Token management utilities

### 3. **API Routes**
- ✅ `/api/auth/signup` - User registration
- ✅ `/api/auth/signin` - User login
- ✅ `/api/auth/logout` - Session termination
- ✅ `/api/auth/me` - Get current user

### 4. **Custom UI Pages** (Cosmic Theme)
- ✅ `/auth/signup` - Registration page
- ✅ `/auth/signin` - Login page
- ✅ Animated cosmic background
- ✅ Consistent Orbitron font
- ✅ Purple/blue gradient theme

### 5. **Authentication Context** (src/contexts/AuthContext.tsx)
- ✅ React Context for auth state
- ✅ useAuth() hook
- ✅ User state management
- ✅ Auto-refresh functionality

### 6. **Middleware** (src/middleware.ts)
- ✅ Route protection
- ✅ Session validation
- ✅ Redirect logic
- ✅ Public route handling

## 🚀 Next Steps to Complete

### Step 1: Install Required Dependencies
```bash
npm install bcryptjs @types/bcryptjs
```

### Step 2: Run Database Migration
```bash
npx prisma migrate dev --name add_auth_and_billing
npx prisma generate
```

### Step 3: Seed Initial Plans
Create `prisma/seed.ts`:
```typescript
import { prisma } from '../src/lib/db';

async function main() {
  // Create plans
  await prisma.plan.createMany({
    data: [
      {
        name: 'free',
        displayName: 'Free',
        description: 'Perfect for trying out',
        price: 0,
        currency: 'USD',
        interval: 'MONTHLY',
        credits: 100,
        features: {
          maxProjects: 5,
          maxGenerations: 100,
          techStacks: ['html-css-js', 'react-nextjs'],
        },
        isActive: true,
      },
      {
        name: 'pro',
        displayName: 'Pro',
        description: 'For professionals',
        price: 19,
        currency: 'USD',
        interval: 'MONTHLY',
        credits: 1000,
        features: {
          maxProjects: -1, // unlimited
          maxGenerations: 1000,
          techStacks: 'all',
          customDomains: true,
        },
        isActive: true,
      },
      {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'For teams',
        price: 99,
        currency: 'USD',
        interval: 'MONTHLY',
        credits: 10000,
        features: {
          maxProjects: -1,
          maxGenerations: 10000,
          techStacks: 'all',
          customDomains: true,
          whiteLabel: true,
          apiAccess: true,
        },
        isActive: true,
      },
    ],
  });
}

main();
```

Run: `npm run prisma:seed`

### Step 4: Create Billing API Routes
Create `/api/billing/subscribe/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionByToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getSessionByToken(sessionToken);
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { planId } = await request.json();
  
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  // Create or update subscription
  await prisma.subscription.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      planId: plan.id,
      status: 'ACTIVE',
    },
  });

  return NextResponse.json({ success: true });
}
```

### Step 5: Update Layout to Include Auth Provider
Modify `src/app/layout.tsx`:
```typescript
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Step 6: Update Components to Use Custom Auth

Replace Clerk hooks with custom hooks:

**Before:**
```typescript
import { useUser } from '@clerk/nextjs';
const { user } = useUser();
```

**After:**
```typescript
import { useAuth } from '@/contexts/AuthContext';
const { user } = useAuth();
```

### Step 7: Update TRPC Procedures
Modify `src/trpc/init.ts` to use custom auth:
```typescript
import { getSessionByToken } from '@/lib/auth';

export const createTRPCContext = async (opts: { headers: Headers; cookies: any }) => {
  const sessionToken = opts.cookies.get('session_token')?.value;
  const session = sessionToken ? await getSessionByToken(sessionToken) : null;

  return {
    auth: {
      userId: session?.user.id || null,
      user: session?.user || null,
    },
  };
};
```

### Step 8: Update Usage System
Modify `src/lib/usage.ts`:
```typescript
import { getSessionByToken } from './auth';
import { prisma } from './db';
import { cookies } from 'next/headers';

export async function consumeCredits() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  
  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  const session = await getSessionByToken(sessionToken);
  if (!session) {
    throw new Error('Invalid session');
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('No active subscription');
  }

  // Check if user has credits
  const usage = await prisma.usage.findUnique({
    where: { key: `user:${session.user.id}` },
  });

  const usedCredits = usage?.points || 0;
  if (usedCredits >= subscription.plan.credits) {
    throw new Error('Credit limit exceeded');
  }

  // Increment usage
  await prisma.usage.upsert({
    where: { key: `user:${session.user.id}` },
    create: {
      key: `user:${session.user.id}`,
      points: 1,
      expire: subscription.currentPeriodEnd,
    },
    update: {
      points: { increment: 1 },
    },
  });
}
```

### Step 9: Remove Clerk Dependencies
```bash
npm uninstall @clerk/nextjs @clerk/themes
```

Remove Clerk imports from:
- `src/app/layout.tsx`
- `src/app/(home)/page.tsx`
- `src/components/user-control.tsx`
- Any other files using Clerk

### Step 10: Update Environment Variables
Remove `.env`:
```
# Remove these:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
# CLERK_SECRET_KEY=...

# Keep these:
DATABASE_URL="..."
OPENAI_API_KEY="..."
E2B_API_KEY="..."
```

## 🎨 UI Features

### Cosmic Theme Consistency
- ✅ Animated star background
- ✅ Purple/blue gradients
- ✅ Orbitron font
- ✅ Glassmorphism effects
- ✅ Smooth animations

### User Experience
- ✅ Form validation
- ✅ Loading states
- ✅ Error messages
- ✅ Success notifications
- ✅ Responsive design

## 🔒 Security Features

- ✅ Password hashing (bcrypt)
- ✅ Session tokens (crypto-secure)
- ✅ HttpOnly cookies
- ✅ Secure middleware
- ✅ Token expiration
- ✅ Session validation

## 💰 Billing Features

- ✅ Multiple plans (Free/Pro/Enterprise)
- ✅ Credit tracking
- ✅ Subscription management
- ✅ Usage limits
- ✅ Payment tracking

## 📊 Testing

1. **Sign Up:** Visit `/auth/signup`
2. **Sign In:** Visit `/auth/signin`
3. **Protected Routes:** Try accessing `/projects`
4. **Sign Out:** Use the logout functionality
5. **Pricing:** Visit `/pricing`

## 🎯 Benefits

1. **Full Control:** Own your data
2. **No Third-Party:** No Clerk fees
3. **Custom Theme:** Perfect cosmic aesthetic
4. **Privacy:** Data stays in your database
5. **Flexibility:** Customize everything
6. **Cost Savings:** No monthly SaaS fees

Your custom authentication and billing system is now ready! 🚀
