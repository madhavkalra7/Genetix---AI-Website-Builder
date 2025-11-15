/**
 * Fetches relevant images from Unsplash/Pexels based on keywords
 * Falls back to relevant placeholder service if both fail
 */
export async function fetchRelevantImages(keywords: string[], count: number = 5): Promise<string[]> {
  try {
    const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
    
    const query = keywords.join(' ');
    
    // Try Unsplash first if API key exists
    if (UNSPLASH_ACCESS_KEY) {
      console.log(`🔍 Trying Unsplash API for: "${query}"`);
      
      try {
        const response = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
          {
            headers: {
              'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const imageUrls = data.results.map((img: any) => img.urls.regular);
            console.log(`✅ Fetched ${imageUrls.length} images from Unsplash`);
            return imageUrls;
          }
        }
      } catch (error) {
        console.warn('⚠️ Unsplash failed, trying Pexels...', error);
      }
    }
    
    // Try Pexels if Unsplash fails or no key
    if (PEXELS_API_KEY) {
      console.log(`� Trying Pexels API for: "${query}"`);
      
      try {
        const response = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
          {
            headers: {
              'Authorization': PEXELS_API_KEY
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.photos && data.photos.length > 0) {
            const imageUrls = data.photos.map((photo: any) => photo.src.large);
            console.log(`✅ Fetched ${imageUrls.length} images from Pexels`);
            return imageUrls;
          }
        }
      } catch (error) {
        console.warn('⚠️ Pexels failed, using fallback...', error);
      }
    }
    
    // Final fallback - Use LoremFlickr (keyword-based, no API key required)
    // It searches Flickr for actual relevant images based on keywords
    console.log(`📸 Using LoremFlickr with keywords: "${query}"`);
    
    const loremFlickrImages: string[] = [];
    const primaryKeyword = keywords[0] || 'website';
    
    for (let i = 0; i < count; i++) {
      // LoremFlickr format: https://loremflickr.com/width/height/keyword
      // Adding random seed to get different images each time
      const randomSeed = Date.now() + i;
      loremFlickrImages.push(`https://loremflickr.com/1200/800/${encodeURIComponent(query)}?random=${randomSeed}`);
    }
    
    console.log(`✅ Generated ${loremFlickrImages.length} LoremFlickr URLs with keyword: "${query}"`);
    return loremFlickrImages;
    
  } catch (error) {
    console.error('❌ All image services failed:', error);
    
    // Ultimate emergency fallback - keyword-based Unsplash direct URLs
    const keyword = keywords[0] || 'website';
    const fallbackImages = Array(count).fill(null).map((_, i) => 
      `https://source.unsplash.com/1200x800/?${encodeURIComponent(keyword)},${i}`
    );
    
    console.log(`🆘 Using emergency fallback with keyword: "${keyword}"`);
    return fallbackImages;
  }
}

/**
 * Extract meaningful keywords from user prompt for image search
 */
export function extractKeywords(prompt: string): string[] {
  // Remove common words and extract meaningful keywords
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'build', 'create', 'make', 'design', 'website', 'web', 'page', 'site',
    'app', 'application', 'project', 'using', 'with', 'that', 'this', 'these',
    'those', 'will', 'would', 'should', 'could', 'can', 'may', 'might'
  ]);
  
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !commonWords.has(word) &&
      !/^\d+$/.test(word) // Remove pure numbers
    );
  
  // Take top 3-5 most relevant keywords
  const keywords = [...new Set(words)].slice(0, 5);
  
  console.log(`🔑 Extracted keywords: [${keywords.join(', ')}]`);
  
  return keywords.length > 0 ? keywords : ['website', 'modern', 'professional'];
}
