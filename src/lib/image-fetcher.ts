/**
 * Fetches relevant images from Unsplash based on keywords
 */
export async function fetchRelevantImages(keywords: string[], count: number = 5): Promise<string[]> {
  try {
    const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!UNSPLASH_ACCESS_KEY) {
      console.warn('⚠️ UNSPLASH_ACCESS_KEY not found, using placeholder images');
      return Array(count).fill('https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=800&fit=crop');
    }

    const query = keywords.join(' ');
    console.log(`🔍 Fetching images for: "${query}"`);
    
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.warn('⚠️ No images found, using fallback');
      return Array(count).fill('https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=800&fit=crop');
    }

    const imageUrls = data.results.map((img: any) => img.urls.regular);
    console.log(`✅ Fetched ${imageUrls.length} images from Unsplash`);
    
    return imageUrls;
  } catch (error) {
    console.error('❌ Error fetching images from Unsplash:', error);
    // Fallback to high-quality placeholder images
    const fallbackImages = [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=1200&h=800&fit=crop',
    ];
    return fallbackImages.slice(0, count);
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
