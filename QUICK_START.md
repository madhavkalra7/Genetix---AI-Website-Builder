# 🚀 Quick Start Guide - Custom Authentication System

## ⚡ Immediate Next Steps (Run These Commands)

### 1. Install Missing Dependencies
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### 2. Run Database Migration
```bash
npx prisma migrate dev --name custom_auth_system
```
This will:
- Create all new authentication tables (User, Session, VerificationToken, etc.)
- Create billing tables (Subscription, Plan, Payment)
- Update Project table with userId foreign key

### 3. Add Seed Script to package.json
Open `package.json` and add this after the dependencies section:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

### 4. Seed Database with Plans
```bash
npx prisma db seed
```
This will create:
- Free Plan ($0/month, 100 credits)
- Pro Plan ($19/month, 1000 credits)
- Enterprise Plan ($99/month, 10000 credits)

### 5. Generate Prisma Client
```bash
npx prisma generate
```

### 6. Start Development Server
```bash
npm run dev
```

## 🧪 Test Your Authentication

### Test Sign Up
1. Open browser to `http://localhost:3000`
2. Click "Sign Up" button
3. Fill in:
   - Email: `test@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
   - Username: `testuser`
   - First Name: `Test`
   - Last Name: `User`
4. Click "Create Account"
5. Should redirect to home page with user logged in

### Test Sign In
1. Click "Sign Out" from user menu
2. Click "Sign In" button
3. Enter email and password
4. Should redirect to home page

### Test Protected Routes
1. Try accessing `/projects` without logging in
2. Should redirect to `/auth/signin`
3. After login, should work normally

### Test Project Creation
1. Sign in as a user
2. Enter a prompt like "Create a landing page"
3. Select "HTML + CSS + JavaScript" tech stack
4. Click "Launch 🚀"
5. Should create project and redirect to project page

## 📁 Important Files Reference

### Authentication API Routes
- `src/app/api/auth/signup/route.ts` - User registration
- `src/app/api/auth/signin/route.ts` - User login
- `src/app/api/auth/logout/route.ts` - User logout
- `src/app/api/auth/me/route.ts` - Get current user

### Auth UI Pages
- `src/app/auth/signup/page.tsx` - Sign up form
- `src/app/auth/signin/page.tsx` - Sign in form

### Core Auth Logic
- `src/lib/auth.ts` - Password hashing, session management, token generation
- `src/contexts/AuthContext.tsx` - Global auth state provider
- `src/middleware.ts` - Route protection

### Database
- `prisma/schema.prisma` - All database models
- `prisma/seed.ts` - Seed data for plans

## 🔑 How Authentication Works

### Sign Up Flow
1. User submits form → `POST /api/auth/signup`
2. Server validates email/password with Zod
3. Password hashed with bcrypt (12 rounds)
4. User created in database
5. Free plan subscription automatically created
6. Session created (7-day expiration)
7. HttpOnly cookie set with session token
8. Returns success response

### Sign In Flow
1. User submits credentials → `POST /api/auth/signin`
2. Server finds user by email
3. Verifies password with bcrypt
4. Creates new session
5. Sets HttpOnly cookie
6. Returns user data

### Middleware Protection
1. Request comes in
2. Middleware checks session cookie
3. If no session → redirect to `/auth/signin`
4. If session expired → redirect to `/auth/signin`
5. If valid session → allow request
6. Public routes (/, /auth/*, /pricing) always allowed

### Using Auth in Components
```typescript
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { user, loading, signOut, refreshUser } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;
  
  return (
    <div>
      <p>Welcome, {user.firstName}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Using Auth in Server Components
```typescript
import { getSessionByToken } from "@/lib/auth";
import { cookies } from "next/headers";

async function MyServerComponent() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  
  if (!sessionToken) {
    return <div>Not authenticated</div>;
  }
  
  const session = await getSessionByToken(sessionToken);
  
  return <div>Welcome, {session?.user.firstName}!</div>;
}
```

## 🐛 Troubleshooting

### "Module not found: Can't resolve 'bcryptjs'"
**Solution**: Run `npm install bcryptjs`

### "Table 'User' does not exist in current database"
**Solution**: Run `npx prisma migrate dev --name custom_auth_system`

### "Plans not showing up in database"
**Solution**: 
1. Add prisma seed config to package.json
2. Run `npx prisma db seed`

### "Session token not working"
**Possible causes**:
- Cookie not being set (check browser devtools → Application → Cookies)
- Session expired (7 days max)
- Database connection issue
**Solution**: Sign out and sign in again

### "Redirect loop on protected routes"
**Cause**: Middleware configuration issue
**Solution**: Check `src/middleware.ts` - ensure public routes are properly configured

### "Type errors in procedures.ts"
**Cause**: `ctx.auth.userId` can be `null`
**Solution**: Already fixed! Added null checks before database queries

## 🎯 What's Different from Clerk

| Feature | Clerk | Custom Auth |
|---------|-------|-------------|
| **Dependencies** | @clerk/nextjs | None (custom) |
| **Data Storage** | Third-party servers | Your database |
| **Customization** | Limited by Clerk API | Full control |
| **Pricing** | Clerk subscription | Free (you pay for hosting) |
| **User Table** | Managed by Clerk | Your Prisma schema |
| **Sessions** | Clerk manages | Your session table |
| **UI Components** | Clerk components | Your custom UI |
| **Password Reset** | Clerk handles | You implement |
| **Email Verification** | Clerk handles | You implement |

## 🎨 UI Components

### User Control Dropdown
Located at: `src/components/user-control.tsx`
Features:
- Shows user avatar with initials
- Displays user name and email
- Links to subscription page
- Sign out button
- Matches cosmic theme

### Sign Up Page
Located at: `src/app/auth/signup/page.tsx`
Features:
- Animated star background
- Purple/blue gradient effects
- Form validation
- Password confirmation
- Toast notifications
- Cosmic theme with Orbitron font

### Sign In Page
Located at: `src/app/auth/signin/page.tsx`
Features:
- Matches sign up design
- Forgot password link (placeholder)
- Remember me option
- Responsive design

### Pricing Page
Located at: `src/app/(home)/pricing/page.tsx`
Features:
- Three pricing tiers
- Feature comparisons
- Popular plan highlight
- Subscribe buttons
- Requires authentication

## 📊 Database Schema Quick Reference

### User Table
- `id` - UUID primary key
- `email` - Unique, required
- `passwordHash` - Bcrypt hashed
- `username` - Optional, unique
- `firstName`, `lastName` - Optional
- `emailVerified` - Boolean (default false)
- `isActive` - Boolean (default true)
- `createdAt`, `updatedAt` - Timestamps

### Session Table
- `id` - UUID primary key
- `token` - Unique session token
- `userId` - Foreign key to User
- `expiresAt` - Session expiration
- `userAgent`, `ipAddress` - Optional tracking

### Subscription Table
- `id` - UUID primary key
- `userId` - Foreign key to User (one-to-one)
- `planId` - Foreign key to Plan
- `status` - ACTIVE, CANCELED, TRIAL, PAST_DUE
- `currentPeriodStart`, `currentPeriodEnd` - Billing period

### Plan Table
- `id` - UUID primary key
- `name` - FREE, PRO, ENTERPRISE
- `price` - Decimal amount
- `interval` - MONTHLY, YEARLY
- `credits` - Number of AI generation credits
- `features` - JSON array of features

## 🔐 Security Best Practices Implemented

✅ Passwords hashed with bcrypt (12 rounds)
✅ HttpOnly cookies (no JavaScript access)
✅ Secure session tokens (crypto.randomBytes)
✅ Session expiration (7 days)
✅ Password minimum length (8 characters)
✅ Email validation with Zod
✅ CSRF protection via same-site cookies
✅ User account status check (isActive)

## 📝 For Your Viva Presentation

### Key Points to Mention:
1. **Why Custom Auth?**
   - Full control over user data
   - No third-party dependencies
   - No recurring costs for auth service
   - Complete customization of UI/UX
   - Better privacy for users

2. **Security Features:**
   - Industry-standard bcrypt hashing
   - Secure session management
   - Protected routes with middleware
   - HttpOnly cookies prevent XSS attacks

3. **Architecture:**
   - Next.js 15 App Router
   - Prisma ORM for database
   - TRPC for type-safe APIs
   - React Context for state management

4. **Database Design:**
   - Normalized schema
   - One-to-one user-subscription relationship
   - Many-to-many subscription-plan potential
   - Audit fields (createdAt, updatedAt)

5. **User Experience:**
   - Cosmic-themed UI matching brand
   - Smooth authentication flow
   - Toast notifications for feedback
   - Responsive design

## 📞 Support

If you encounter issues:
1. Check `CUSTOM_AUTH_GUIDE.md` for detailed documentation
2. Check `MIGRATION_COMPLETE.md` for migration summary
3. Review error messages in browser console
4. Check terminal for server errors
5. Verify database connection in Prisma Studio: `npx prisma studio`

---

**You're ready to go! Good luck with your viva! 🎉**
