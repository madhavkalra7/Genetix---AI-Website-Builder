# Website Generation Optimization Guide

## 🎯 Overview

This guide covers two major optimizations implemented for AI-generated websites:

1. **Multi-page Navigation Fix** - Websites with multiple pages now have working internal navigation
2. **Automatic Image Integration** - Relevant, high-quality images from Unsplash are automatically added to generated websites

---

## 🔧 Changes Made

### 1. Multi-page Navigation Fix

**Problem**: When the AI generated multi-page websites (e.g., "create a restaurant website with Home, Menu, About, Contact"), clicking internal links didn't work. Only the homepage would load in the iframe preview.

**Solution**: Enhanced the AI prompt with explicit multi-page navigation rules.

**Files Modified**:
- `src/prompt.ts` - Updated `HTML_CSS_JS_PROMPT` with comprehensive multi-page navigation rules

**Key Features**:
- ✅ `<base href="./">` tag in every HTML `<head>` section
- ✅ Relative paths for all internal links: `<a href="./about.html">About</a>`
- ✅ Navigation menu on every page
- ✅ Consistent CSS and JS linking across all pages
- ✅ Proper file structure with separate HTML files for each page

**Example Generated Structure**:
```
index.html       (Homepage with nav menu)
about.html       (About page with nav menu)
contact.html     (Contact page with nav menu)
menu.html        (Menu page with nav menu)
style.css        (Shared styles)
script.js        (Shared JavaScript)
```

Each HTML file will have:
```html
<!DOCTYPE html>
<html>
<head>
  <base href="./">
  <link rel="stylesheet" href="./style.css">
  <title>Page Title</title>
</head>
<body>
  <nav>
    <a href="./index.html">Home</a>
    <a href="./about.html">About</a>
    <a href="./contact.html">Contact</a>
    <a href="./menu.html">Menu</a>
  </nav>
  
  <!-- Page content -->
  
  <script src="./script.js"></script>
</body>
</html>
```

---

### 2. Automatic Image Integration

**Problem**: Generated websites used placeholder images or generic stock photos, making them look unprofessional.

**Solution**: Integrated Unsplash API to automatically fetch relevant, high-quality images based on the user's prompt.

**Files Created**:
- `src/lib/image-fetcher.ts` - New utility for Unsplash API integration

**Files Modified**:
- `src/inngest/functions.ts` - Integrated image fetcher into AI generation pipeline
- `.env` - Added `UNSPLASH_ACCESS_KEY` variable

**How It Works**:

1. **Keyword Extraction**: 
   - Analyzes user prompt (e.g., "create a fitness gym website")
   - Extracts meaningful keywords: `["fitness", "gym", "workout", "training", "health"]`
   - Filters out common words (the, a, and, create, website, build, etc.)

2. **Image Fetching**:
   - Calls Unsplash API with extracted keywords
   - Fetches 5 high-quality, landscape-oriented images
   - Falls back to professional placeholder images if API fails

3. **AI Integration**:
   - Passes image URLs to AI agent in enhanced prompt
   - AI naturally integrates images into design:
     - Image 1 → Hero section / main banner
     - Images 2-3 → Content sections / features
     - Images 4-5 → Galleries / backgrounds

**Example**:
```
User Prompt: "Create a restaurant website with menu and contact"
Keywords Extracted: ["restaurant", "food", "menu", "dining", "cuisine"]
Images Fetched: 5 restaurant-related high-quality photos
AI Output: Professional restaurant website with relevant food photography
```

---

## 🔑 Unsplash API Setup

### Step 1: Get Your API Key

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Click "Register as a Developer"
3. Create a new application:
   - **Application Name**: Genetix AI Website Builder
   - **Description**: AI-powered website builder that automatically integrates relevant images
   - **Terms**: Accept the terms

4. Copy your **Access Key** (starts with `...`)

### Step 2: Add to Local Environment

1. Open `.env` file in the project root
2. Find the line: `UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here`
3. Replace with your actual key: `UNSPLASH_ACCESS_KEY=abc123xyz456...`
4. Save the file
5. Restart your dev server: `npm run dev`

### Step 3: Add to Vercel (Production)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `genetix-ai-website-builder`
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Key**: `UNSPLASH_ACCESS_KEY`
   - **Value**: Your Unsplash Access Key
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development
5. Click "Save"
6. Redeploy your application

---

## 🧪 Testing

### Test Multi-page Navigation

1. Create a new project with prompt:
   ```
   Build a restaurant website with Home, Menu, About, and Contact pages
   ```

2. Wait for AI to generate the website

3. Verify in the file explorer:
   - ✅ `index.html` exists
   - ✅ `menu.html` exists
   - ✅ `about.html` exists
   - ✅ `contact.html` exists
   - ✅ `style.css` exists

4. Test navigation in preview:
   - ✅ Click "Menu" → Menu page loads
   - ✅ Click "About" → About page loads
   - ✅ Click "Contact" → Contact page loads
   - ✅ Click "Home" → Homepage loads
   - ✅ All pages have the same navigation menu

### Test Image Integration

1. Create a new project with prompt:
   ```
   Build a modern fitness gym website
   ```

2. Check browser console (F12) for logs:
   ```
   🔍 Extracted keywords: ["fitness", "gym", "workout", "training", "health"]
   🖼️ Fetched images: [5 Unsplash URLs]
   📝 Enhanced prompt with images
   ```

3. Wait for AI to generate the website

4. Verify in preview:
   - ✅ Hero section has a relevant fitness image
   - ✅ Content sections have workout/gym photos
   - ✅ Gallery or features section has multiple images
   - ✅ All images load properly (not 404)
   - ✅ Images are responsive (look good on mobile)

5. Inspect image sources:
   - Right-click image → Inspect
   - Check `src` attribute contains `unsplash.com` URL
   - Images should be high-quality (not pixelated)

---

## 📊 API Limits

### Unsplash Free Tier

- **Rate Limit**: 50 requests per hour
- **Cost**: Free forever
- **Images**: Unlimited access to 3M+ high-quality photos
- **Attribution**: Not required (but recommended)

### If You Hit Rate Limit

The image fetcher has built-in fallback:
- Returns 5 professional placeholder images
- Logs warning in console: `⚠️ Using fallback images`
- Website generation continues without interruption

### Production Considerations

- **Caching**: Consider caching fetched images for common keywords
- **Upgrade**: Unsplash Plus ($7/month) gives 5000 requests/hour
- **Alternative**: Can implement image caching in database to reduce API calls

---

## 🐛 Troubleshooting

### Issue: Multi-page links not working

**Symptoms**: Clicking navigation links doesn't load other pages

**Solutions**:
1. Check if `<base href="./">` is in HTML `<head>`
2. Verify links use relative paths: `./page.html` not `/page.html`
3. Check browser console for 404 errors
4. Ensure all HTML files were created by AI

**Debug**:
```javascript
// In browser console on preview page
console.log(document.querySelector('base')?.href); // Should show "./
console.log(document.querySelectorAll('nav a')); // Check link hrefs
```

### Issue: Images not loading

**Symptoms**: Broken image icons or 404 errors

**Solutions**:
1. Verify `UNSPLASH_ACCESS_KEY` is set in `.env`
2. Check console logs for Unsplash API errors
3. Verify API key is valid (test at [Unsplash API](https://api.unsplash.com/))
4. Check rate limit (50 requests/hour free tier)

**Debug**:
```bash
# Test Unsplash API directly
curl -H "Authorization: Client-ID YOUR_ACCESS_KEY" \
  "https://api.unsplash.com/search/photos?query=fitness&per_page=5"
```

### Issue: No images in generated website

**Symptoms**: Website generated but no images appear

**Solutions**:
1. Check if keywords were extracted: Look for `🔍 Extracted keywords` log
2. Verify images were fetched: Look for `🖼️ Fetched images` log
3. Check if prompt was enhanced: Look for `📝 Enhanced prompt with images` log
4. Ensure Inngest function is running: `npm run inngest-dev`

**Debug**:
```javascript
// In src/inngest/functions.ts, add more logging:
console.log("Keywords:", keywords);
console.log("Image URLs:", imageUrls);
console.log("Enhanced Prompt:", enhancedPrompt);
```

### Issue: Wrong images for topic

**Symptoms**: Images don't match the website topic

**Solutions**:
1. Improve keyword extraction: Add more specific terms to prompt
2. Use more descriptive prompts: "luxury Italian restaurant" instead of "restaurant"
3. Check keyword filtering: May be removing important words

**Debug**:
```javascript
// Test keyword extraction
import { extractKeywords } from '@/lib/image-fetcher';
console.log(extractKeywords("Build a luxury Italian restaurant website"));
// Should output: ["luxury", "italian", "restaurant", "dining", "cuisine"]
```

---

## 🚀 Next Steps

### Potential Enhancements

1. **Image Caching**:
   - Store fetched images in database
   - Reuse for similar prompts
   - Reduce API calls

2. **Custom Image Upload**:
   - Allow users to upload their own images
   - Mix custom + Unsplash images
   - Store in cloud storage (S3/Cloudflare R2)

3. **Image Optimization**:
   - Compress images before serving
   - Generate responsive sizes (webp, avif)
   - Lazy loading implementation

4. **Advanced Navigation**:
   - Support for subdirectories (`/blog/post.html`)
   - Dynamic routing with query params
   - SPA-like navigation for smoother UX

5. **Alternative Image Sources**:
   - Pexels API (free, unlimited)
   - Pixabay API (free)
   - DALL-E generated images (OpenAI)

---

## 📝 Summary

### What's Fixed:
✅ Multi-page static websites now have working navigation  
✅ Internal links properly load other pages  
✅ All pages have consistent navigation menus  
✅ CSS and JS shared across all pages  

### What's Added:
✅ Automatic Unsplash image integration  
✅ Keyword extraction from user prompts  
✅ 5 relevant images per website  
✅ Fallback to professional placeholders  
✅ Images naturally integrated by AI  

### What to Do:
1. Get Unsplash API key from [unsplash.com/developers](https://unsplash.com/developers)
2. Add to `.env`: `UNSPLASH_ACCESS_KEY=your_key_here`
3. Add to Vercel environment variables
4. Restart dev server
5. Test with multi-page website prompt
6. Test with image-heavy website prompt
7. Monitor console logs for debugging

---

## 💡 Tips

- **Be Specific**: "luxury Italian restaurant with marble decor" → Better images than just "restaurant"
- **Use Descriptive Prompts**: More context = Better keywords = Better images
- **Check File Explorer**: Verify all HTML pages were created
- **Test Navigation**: Click every link to ensure it works
- **Monitor Console**: Watch for API errors or rate limiting
- **Fallback Ready**: System gracefully handles API failures

---

## 📞 Support

If you encounter any issues:

1. Check browser console (F12) for errors
2. Check server logs for API failures
3. Verify environment variables are set
4. Test Unsplash API key validity
5. Check rate limits (50/hour free tier)
6. Review this troubleshooting guide

For Unsplash API issues: [Unsplash Support](https://unsplash.com/documentation)

---

**Last Updated**: October 30, 2025  
**Status**: ✅ Ready for Production  
**Version**: 2.0
