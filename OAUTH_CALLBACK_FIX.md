# OAuth Callback URL Fix Guide

## Issue
OAuth buttons redirect to Google/GitHub successfully, but return with `error=google` or `error=github` parameter.

## Root Cause
The callback URLs in your OAuth app settings don't match NextAuth's expected format.

---

## Google OAuth Fix

### Step 1: Open Google Cloud Console
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID: `146654699105-rqh2isn45t7qu70gjm70t0t545a75dp1.apps.googleusercontent.com`

### Step 2: Update Authorized Redirect URIs
In the **Authorized redirect URIs** section, make sure you have:

```
http://localhost:3000/api/auth/callback/google
```

**Important Notes:**
- Must be EXACT match (no trailing slash)
- Must use `http://` for localhost (not `https://`)
- Path must be `/api/auth/callback/google` (not `/api/auth/signin/google`)

### Step 3: Save Changes
Click **SAVE** button at the bottom.

⚠️ **Wait 5 minutes** after saving for Google to propagate the changes.

---

## GitHub OAuth Fix

### Step 1: Open GitHub OAuth App Settings
1. Go to: https://github.com/settings/developers
2. Click on **OAuth Apps**
3. Click on your app name

### Step 2: Update Authorization Callback URL
In the **Authorization callback URL** field, enter:

```
http://localhost:3000/api/auth/callback/github
```

**Important Notes:**
- Only ONE callback URL allowed in GitHub (unlike Google)
- Must be EXACT match (no trailing slash)
- Must use `http://` for localhost
- Path must be `/api/auth/callback/github` (not `/api/auth/signin/github`)

### Step 3: Save Changes
Click **Update application** button.

✅ GitHub changes are instant (no waiting needed)

---

## For Production Deployment

When you deploy to production (e.g., Vercel), you need to:

### Google (supports multiple URIs):
Add BOTH localhost AND production URLs:
```
http://localhost:3000/api/auth/callback/google
https://yourdomain.com/api/auth/callback/google
```

### GitHub (only one URI):
You'll need to create a **separate GitHub OAuth App** for production:
- Development App: `http://localhost:3000/api/auth/callback/github`
- Production App: `https://yourdomain.com/api/auth/callback/github`

Then use environment variables to switch between them:
```env
# .env.local (development)
GITHUB_ID=your_dev_app_client_id
GITHUB_SECRET=your_dev_app_secret

# .env.production (production)
GITHUB_ID=your_prod_app_client_id
GITHUB_SECRET=your_prod_app_secret
```

---

## Testing After Fix

1. Clear browser cookies for localhost:3000
2. Restart your dev server: `npm run dev`
3. Click "Continue with Google" or "Continue with GitHub"
4. Authorize the app
5. You should be redirected back and logged in successfully! ✅

---

## Current OAuth App Details

**Google OAuth 2.0 Client:**
- Client ID: `146654699105-rqh2isn45t7qu70gjm70t0t545a75dp1.apps.googleusercontent.com`
- Console: https://console.cloud.google.com/apis/credentials

**GitHub OAuth App:**
- Client ID: `Ov23li0W1SSyLfHqRnTf`
- Settings: https://github.com/settings/developers

---

## Common Mistakes to Avoid

❌ **Wrong:** `http://localhost:3000/api/auth/signin/google`
✅ **Correct:** `http://localhost:3000/api/auth/callback/google`

❌ **Wrong:** `http://localhost:3000/api/auth/callback/google/`
✅ **Correct:** `http://localhost:3000/api/auth/callback/google`

❌ **Wrong:** `https://localhost:3000/api/auth/callback/google`
✅ **Correct:** `http://localhost:3000/api/auth/callback/google`

---

## Need More Help?

If still not working after following this guide:

1. Check browser console for errors (F12 → Console tab)
2. Check dev server terminal for NextAuth error logs
3. Verify `.env` file has correct credentials
4. Try deleting browser cookies and cache
5. Wait 5 minutes after changing Google OAuth settings

