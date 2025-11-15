export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  templateFile: string; // Path to the actual HTML template file
  category: string;
  techStacks: string[];
  designPrompt: string;
}

export const templates: Template[] = [
  {
    id: "modern-saas",
    name: "Modern SaaS",
    description: "Clean and professional SaaS landing page with hero section, features, and pricing",
    thumbnail: "https://dummyimage.com/400x300/6366f1/ffffff&text=Modern+SaaS",
    templateFile: "/templates/modern-saas.html",
    category: "Business",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Modern SaaS Landing Page
- Hero Section: Large heading, subheading, CTA button, hero image on right
- Features Section: 3-column grid with icons, titles, descriptions
- Pricing Section: 3 pricing cards (Free, Pro, Enterprise) with feature lists
- Footer: Links, social icons, copyright
Color Scheme: Indigo (#6366f1) primary, white background, gray text
Typography: Bold headings (2xl-4xl), medium body text
Layout: Full-width sections, max-width 1200px container, padding 4-8rem
Components: Gradient buttons, shadow cards, rounded corners (lg)
`
  },
  {
    id: "portfolio-minimal",
    name: "Minimal Portfolio",
    description: "Elegant portfolio with projects showcase, about section, and contact form",
    thumbnail: "https://dummyimage.com/400x300/14b8a6/ffffff&text=Minimal+Portfolio",
    templateFile: "/templates/portfolio-minimal.html",
    category: "Portfolio",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Minimal Portfolio
- Hero: Name, tagline, animated gradient text, minimal navigation
- About: Short bio, skills tags, profile image (circular)
- Projects: 2-column grid, project cards with image, title, description, tech stack
- Contact: Simple form (name, email, message), social links
Color Scheme: Teal (#14b8a6) accent, black/white, subtle gradients
Typography: Clean sans-serif, large headings, comfortable line-height
Layout: Centered content, asymmetric spacing, white space emphasis
Components: Hover effects, smooth transitions, glassmorphism cards
`
  },
  {
    id: "restaurant-elegant",
    name: "Elegant Restaurant",
    description: "Beautiful restaurant website with menu, gallery, and reservation system",
    thumbnail: "https://dummyimage.com/400x300/f59e0b/ffffff&text=Elegant+Restaurant",
    templateFile: "/templates/restaurant-elegant.html",
    category: "Restaurant",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Elegant Restaurant
- Hero: Full-screen background image, restaurant name (elegant serif font), tagline, "Reserve Table" CTA
- About: Restaurant story, chef introduction, 2-column layout
- Menu: Tabbed sections (Appetizers, Main Course, Desserts), dish cards with name, description, price
- Gallery: Masonry grid of food/restaurant images
- Reservation: Date picker, time slots, party size, contact form
Color Scheme: Amber (#f59e0b) gold accents, dark background, cream text
Typography: Serif headings (elegant), sans-serif body, script font for special text
Layout: Full-width hero, contained sections, elegant spacing
Components: Image overlays, hover zoom effects, subtle animations
`
  },
  {
    id: "ecommerce-modern",
    name: "Modern E-Commerce",
    description: "Product showcase with categories, filters, and shopping cart",
    thumbnail: "https://dummyimage.com/400x300/ec4899/ffffff&text=Modern+Shop",
    templateFile: "/templates/ecommerce-modern.html",
    category: "E-Commerce",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Modern E-Commerce
- Header: Logo, search bar, cart icon, navigation menu
- Hero: Large banner with seasonal promotion, shop now button
- Categories: Icon grid (Electronics, Fashion, Home, etc.)
- Products: 4-column grid, product cards (image, name, price, rating, add to cart)
- Filters: Sidebar with price range, categories, ratings
- Footer: Payment methods, links, newsletter signup
Color Scheme: Pink (#ec4899) primary, white cards, light gray background
Typography: Bold product names, clear pricing, readable descriptions
Layout: Grid-based, responsive columns, sticky header
Components: Star ratings, price tags, badge labels (Sale, New), quantity selectors
`
  },
  {
    id: "blog-modern",
    name: "Modern Blog",
    description: "Content-focused blog with articles, categories, and author profiles",
    thumbnail: "https://dummyimage.com/400x300/8b5cf6/ffffff&text=Modern+Blog",
    templateFile: "/templates/blog-modern.html",
    category: "Blog",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Modern Blog
- Header: Site logo, navigation (Home, Categories, About), search icon
- Featured Post: Large card with image, title, excerpt, author info, read time
- Articles Grid: 3-column layout, article cards with thumbnail, title, excerpt, date, category tag
- Sidebar: Author bio, popular posts, categories list, tags cloud
- Article Page: Hero image, title, author info, published date, formatted content, share buttons
Color Scheme: Purple (#8b5cf6) accents, white background, dark text
Typography: Large readable font (18px), bold headings, serif for content
Layout: Centered content (max-width 800px for articles), sidebar layout
Components: Category badges, author avatars, reading time indicator, social share buttons
`
  },
  {
    id: "agency-creative",
    name: "Creative Agency",
    description: "Bold agency website with services, team showcase, and portfolio",
    thumbnail: "https://dummyimage.com/400x300/10b981/ffffff&text=Creative+Agency",
    templateFile: "/templates/agency-creative.html",
    category: "Business",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Creative Agency
- Hero: Animated headline, creative tagline, colorful background gradient, CTA button
- Services: 4-column icon grid (Design, Development, Marketing, Branding)
- Portfolio: Full-width showcase with hover effects, project categories filter
- Team: Team member cards with photos, names, roles, social links
- Process: Timeline/steps visualization (Discovery → Design → Development → Launch)
- Contact: Split screen (form on left, map/info on right)
Color Scheme: Emerald (#10b981) primary, bold multi-color accents, dark sections
Typography: Bold display fonts, playful headings, modern sans-serif
Layout: Asymmetric layouts, diagonal sections, overlapping elements
Components: Animated gradients, parallax effects, morphing shapes, micro-interactions
`
  },
  {
    id: "arcade-gaming",
    name: "Arcade Gaming Portal",
    description: "Retro 8-bit gaming template with pixel art effects, arcade cabinet frame, and game showcase",
    thumbnail: "https://dummyimage.com/400x300/ff00ff/00ff00&text=Arcade+Gaming",
    templateFile: "/templates/arcade-gaming.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Retro Arcade Gaming
- Hero: "INSERT COIN" title with pixel font, glitch animations, retro grid background with 3D perspective
- Game Screen: Arcade cabinet frame (neon borders) with main game canvas area for user's game logic
- Games Grid: 6 retro game cards (Space Invader, Runner, Puzzle, Target, Dungeon, Racing) with scanline effects
- Features: Power-ups section with pixel-style icons and descriptions
- Background: Scrolling 3D grid, neon pink sun, 40 floating pixel particles (cyan/magenta/green/yellow)
Color Scheme: Neon green (#00ff00), cyan (#0ff), magenta (#ff00ff), black background
Typography: Press Start 2P pixel font, bold 8-bit style text, text-shadow glows
Layout: Centered content, arcade cabinet showcase, retro spacing
Components: Glitch effects, pixel particles, scanline animations, bouncing icons, neon shadows
Special: Main game screen container where users can integrate their game canvas/logic via prompts
`
  },
  {
    id: "cyber-gaming",
    name: "Cyber Gaming Network",
    description: "Futuristic cyberpunk gaming template with matrix effects, holographic UI, and VR game showcase",
    thumbnail: "https://dummyimage.com/400x300/00ffff/8a2be2&text=Cyber+Gaming",
    templateFile: "/templates/cyber-gaming.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Cyberpunk Futuristic Gaming
- Hero: "ENTER THE MATRIX" with gradient text animation, digital rain background
- Game Terminal: Holographic terminal frame with rainbow rotating border, green CRT screen with scanlines
- VR Games Grid: 6 futuristic game cards (VR Combat, Space Odyssey, AI Warfare, Cyber Arena, Neural Hack, Quantum Race) with 3D perspective transforms
- Features: Cyber modules with holographic effects and sliding light animations
- Background: Matrix digital rain (30 columns), 15 hexagon grid elements, 3 floating holographic orbs, 30 laser particles
Color Scheme: Cyan (#00ffff) primary, magenta (#ff00ff), purple (#8a2be2), green (#0f0) accents
Typography: Orbitron futuristic font, uppercase headings, wide letter-spacing, neon text shadows
Layout: Centered terminal, 3D perspective effects, holographic spacing
Components: Matrix rain animation, hexagon pulse, conic gradient rotating borders, scanline effects, laser particles
Special: Terminal screen container for game logic integration, VR/AR support indicators
`
  },
  {
    id: "pixel-platformer",
    name: "Pixel Platformer Kingdom",
    description: "Retro pixel art platformer template with Mario-style graphics, animated blocks, and game canvas",
    thumbnail: "https://dummyimage.com/400x300/5c94fc/ffffff&text=Pixel+Platformer",
    templateFile: "/templates/pixel-platformer.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Pixel Art Platformer (Mario-inspired)
- Hero: "PLATFORMER ADVENTURE" title with multi-layer shadow, pixelated clouds floating across sky
- Background: Bright blue sky (#5c94fc), white pixelated clouds, spinning gold coins, power-up stars
- Game Frame: Brown brick border with inset 3D effect, blue game screen display for canvas
- Platform: Row of 5 bouncing pixel blocks at bottom of hero section
- Levels Grid: 6 level cards (Castle, Forest, Mountain, Ocean, Volcano, Sky) with green background and 3D pixel shadows
- Power-Ups: 4 power-up boxes (Mushroom, Star, Fire Flower, Double Coins) with brick texture and question mark watermark
- Animations: Coin spinning (rotateY 180deg), star twinkling, block bouncing, character running
Color Scheme: Sky blue (#5c94fc), green (#00a800), brick red (#c84c0c), gold (#ffd700), white clouds
Typography: Press Start 2P pixel font, bold text with black outline shadows, all-caps headings
Layout: Centered content, pixelated spacing (multiples of 8px), retro arcade feel
Components: Pixel-perfect rendering, 3D block shadows (inset highlights/lowlights), bouncing animations, spinning coins
Special: Main game canvas area with character preview, supports platformer mechanics (jumping, scrolling, collision)
`
  }
];

export const getTemplateById = (id: string): Template | undefined => {
  return templates.find(t => t.id === id);
};

export const getTemplatesByTechStack = (techStack: string): Template[] => {
  return templates.filter(t => t.techStacks.includes(techStack));
};
