# 🔧 OAuth Issues Fixed - Quick Guide

## ✅ Problems That Were Fixed

### 1. **HTTP ERROR 405** 
- **Problem**: NextAuth routes returning 405 Method Not Allowed
- **Fix**: Changed OAuth button URLs from `?provider=google` to `/google`
- **Correct URL**: `/api/auth/signin/google` (not `?provider=google`)

### 2. **Edge Runtime Error**
- **Problem**: `crypto` module not supported in Edge Runtime
- **Fix**: Added `export const runtime = 'nodejs'` to middleware
- **Result**: Middleware now runs in Node.js runtime

### 3. **NextAuth Routes Not Working**
- **Problem**: Middleware was blocking NextAuth API routes
- **Fix**: Added exception for `/api/auth` routes in middleware
- **Result**: OAuth flow can now proceed

## 🚀 How to Test Now

### Step 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 2: Test Google OAuth
1. Go to: `http://localhost:3000/auth/signin`
2. Click "**Continue with Google**" button
3. Should redirect to Google authorization page
4. Select your account and allow
5. Should come back logged in!

### Step 3: Test GitHub OAuth  
1. Click "**Continue with GitHub**" button
2. Should redirect to GitHub authorization page
3. Click "Authorize"
4. Should come back logged in!

## 📋 What Changed

### File 1: `src/middleware.ts`
```typescript
// Added Node.js runtime
export const runtime = 'nodejs';

// Added NextAuth route exception
if (pathname.startsWith('/api/auth')) {
  return NextResponse.next();
}

// Simplified session check
const nextAuthSession = request.cookies.get('next-auth.session-token')?.value;
const isAuthenticated = !!(sessionToken || nextAuthSession);
```

### File 2: `src/app/auth/signin/page.tsx` & `signup/page.tsx`
```typescript
// OLD (Wrong):
window.location.href = "/api/auth/signin?provider=google";

// NEW (Correct):
window.location.href = "/api/auth/signin/google";
```

### File 3: `src/lib/auth-config.ts`
```typescript
// Added debug mode for development
debug: process.env.NODE_ENV === 'development',
```

## 🎯 OAuth URLs Reference

### Correct OAuth URLs (NextAuth Standard):
- **Google**: `http://localhost:3000/api/auth/signin/google`
- **GitHub**: `http://localhost:3000/api/auth/signin/github`
- **Callback Google**: `http://localhost:3000/api/auth/callback/google`
- **Callback GitHub**: `http://localhost:3000/api/auth/callback/github`

### Wrong URLs (Don't Use):
- ❌ `/api/auth/signin?provider=google`
- ❌ `/auth/google`
- ❌ `/signin/google`

## 🔍 Check If OAuth is Working

### Console Logs to Look For:
When you click OAuth button, check browser console:
```
Navigating to /api/auth/signin/google
```

If you see `405 Method Not Allowed`, something is still wrong.

### Network Tab Check:
1. Open DevTools (F12)
2. Go to Network tab
3. Click OAuth button
4. Should see:
   - Request to `/api/auth/signin/google`
   - Status: 302 (Redirect to Google/GitHub)
   - Redirect Location: `https://accounts.google.com/...`

## 🐛 If Still Not Working

### Check 1: Environment Variables
```bash
# Make sure these are set in .env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_ID=...
GITHUB_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### Check 2: Database Migration
```bash
# Make sure Account table exists
npx prisma generate
npx prisma db push
```

### Check 3: Clear Browser Cache
- Clear cookies
- Hard refresh (Ctrl+Shift+R)
- Try incognito mode

### Check 4: Check Terminal Output
Look for NextAuth debug logs:
```
[auth][debug] signin callback
[auth][debug] callback url: http://localhost:3000
```

## ✅ Success Indicators

### Working Google OAuth:
1. Click button
2. Redirects to Google
3. Shows "Choose an account"
4. After selection, comes back to your site
5. User is logged in
6. Navbar shows user avatar

### Working GitHub OAuth:
1. Click button
2. Redirects to GitHub
3. Shows "Authorize application"
4. After authorize, comes back to your site
5. User is logged in
6. Navbar shows user avatar

## 🎉 Final Checklist

Before testing:
- [ ] Dev server restarted
- [ ] `.env` has all OAuth credentials
- [ ] Google OAuth app configured
- [ ] GitHub OAuth app configured
- [ ] Database has Account table
- [ ] Browser cache cleared
- [ ] Incognito mode (optional)

If all green ✅, OAuth should work perfectly!

---

**Now try clicking those OAuth buttons!** 🚀
