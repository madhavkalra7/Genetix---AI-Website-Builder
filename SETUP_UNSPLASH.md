# 🎨 Unsplash API Setup - Quick Start

## What's This For?

Your AI website builder now automatically adds relevant, high-quality images to generated websites! Instead of boring placeholders, users get professional photos based on their prompts.

**Example**: User says "build a gym website" → AI automatically uses 5 fitness-related images from Unsplash 🏋️

---

## 🚀 Quick Setup (3 Minutes)

### Step 1: Get Free API Key

1. Go to: **https://unsplash.com/developers**
2. Click "**Register as a Developer**"
3. Create account (or login)
4. Click "**New Application**"
5. Fill in:
   - **App Name**: Genetix AI Website Builder
   - **Description**: AI-powered website builder with automatic image integration
6. ✅ Accept terms
7. Click "**Create Application**"
8. Copy your **Access Key** (looks like: `abc123xyz456...`)

---

### Step 2: Add to Local Development

1. Open `.env` file in your project
2. Find this line:
   ```
   UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
   ```
3. Replace with your real key:
   ```
   UNSPLASH_ACCESS_KEY=abc123xyz456yourrealkeyhere
   ```
4. **Save** the file
5. Restart dev server:
   ```bash
   npm run dev
   ```

---

### Step 3: Add to Vercel (Production)

1. Go to: **https://vercel.com/dashboard**
2. Select project: `genetix-ai-website-builder`
3. Go to **Settings** → **Environment Variables**
4. Click "**Add New**"
5. Enter:
   - **Name**: `UNSPLASH_ACCESS_KEY`
   - **Value**: Your Unsplash Access Key
   - **Environments**: ✅ Production ✅ Preview ✅ Development
6. Click "**Save**"
7. Go to **Deployments** tab
8. Click "**Redeploy**" on latest deployment

---

## ✅ Test It

Create a new project with this prompt:
```
Build a modern gym website with workout programs and pricing
```

### What Should Happen:

1. **In Console** (press F12):
   ```
   🔍 Extracted keywords: ["gym", "workout", "fitness", "training", "programs"]
   🖼️ Fetched images: [5 Unsplash URLs]
   📝 Enhanced prompt with images
   ```

2. **In Generated Website**:
   - ✅ Hero section has fitness image
   - ✅ Content sections have workout photos
   - ✅ Gallery has gym equipment images
   - ✅ All images load (no broken icons)

---

## 📊 Free Tier Limits

- **50 requests per hour**
- **3,000,000+ photos** available
- **No cost** forever
- **No attribution required**

If you hit the limit, the system automatically uses professional placeholder images (no errors, no broken websites).

---

## 🐛 Troubleshooting

### Images not loading?

**Check:**
1. Is `UNSPLASH_ACCESS_KEY` in `.env`? ✅
2. Did you restart dev server after adding key? ✅
3. Is Inngest running? Run `npm run inngest-dev` ✅

**Test API Key:**
```bash
curl -H "Authorization: Client-ID YOUR_KEY_HERE" \
  "https://api.unsplash.com/search/photos?query=test&per_page=1"
```

Should return JSON with photos. If error, key is invalid.

### Wrong images for topic?

Use **more specific prompts**:
- ❌ "restaurant website" → Generic food photos
- ✅ "luxury Italian restaurant with marble decor" → Better targeted images

---

## 🎯 How It Works

1. **User prompt**: "Build a fitness gym website"
2. **Extract keywords**: `["fitness", "gym", "workout", "training", "health"]`
3. **Fetch images**: Call Unsplash API with keywords
4. **Get 5 URLs**: High-quality, landscape-oriented photos
5. **Enhance prompt**: Pass URLs to AI agent
6. **AI integrates**: Automatically adds images to hero, sections, gallery
7. **Website ready**: Professional-looking with relevant photos!

---

## 📝 Files Changed

- ✅ `src/lib/image-fetcher.ts` - New utility for Unsplash API
- ✅ `src/inngest/functions.ts` - Integrated into AI pipeline
- ✅ `src/prompt.ts` - Enhanced with image instructions
- ✅ `.env` - Added UNSPLASH_ACCESS_KEY variable

---

## 🔗 Resources

- **Unsplash Developers**: https://unsplash.com/developers
- **API Documentation**: https://unsplash.com/documentation
- **Dashboard**: https://unsplash.com/oauth/applications
- **Guidelines**: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines

---

## ✨ That's It!

Your AI website builder now automatically fetches and integrates relevant images. No more boring placeholders! 🎉

**Questions?** Check the full guide: `WEBSITE_OPTIMIZATION_GUIDE.md`
