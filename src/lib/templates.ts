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
  },
  {
    id: "superhero-adventure",
    name: "Superhero Arena",
    description: "Comic book style superhero game with lightning bolts, flying capes, and epic hero vs villain battles",
    thumbnail: "https://dummyimage.com/400x300/1e3c72/ffd700&text=Superhero+Arena",
    templateFile: "/templates/superhero-adventure.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Comic Book Superhero
- Hero: "SUPERHERO ARENA" title with Bangers comic font, bold multi-layer text shadows (black+red+blue+white)
- Background: Blue-purple gradient (#1e3c72 → #7e22ce), 5 lightning bolt strikes, 3 floating energy orbs, 2 flying capes, comic explosions
- Speech Bubble: "WITH GREAT POWER COMES GREAT RESPONSIBILITY" - CSS-only triangular tail
- Game Canvas: 900x600px with golden border, hero character (40x40 red body with cape), enemies, power-ups (⚡🛡️💥⭐)
- Mechanics: WASD/Arrow movement, collision detection, particle explosions, score tracking, lives system, level progression
- Scoreboard: Purple gradient cards showing Score, Lives, Level - Bangers font numbers
- Buttons: 3D comic style with ripple animation (Start Mission, Pause, Reset)
Color Scheme: Gold (#ffd700) primary, blue gradient background, cyan (#00ffff) tech elements, red/black shadows
Typography: Bangers for headings, Bebas Neue for body, bold comic book text shadows
Layout: Centered game arena, comic halftone pattern texture, full-screen background animations
Components: Lightning strike animation, energy orb floating, cape flying, explosion scaling, spark rotation, particle system
Special: Canvas-based game with hero movement, enemy spawning, power-up collection, comic visual effects
`
  },
  {
    id: "harry-potter-magic",
    name: "Wizarding World Challenge",
    description: "Hogwarts themed magical game with spell casting, floating candles, golden snitches, and wizard duels",
    thumbnail: "https://dummyimage.com/400x300/1a0033/ffd700&text=Wizarding+World",
    templateFile: "/templates/harry-potter-magic.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Harry Potter Wizarding World
- Hero: "HOGWARTS SPELL CHALLENGE" with MedievalSharp font, gold color (#ffd700), glowing text animation
- Background: Purple-dark gradient (#1a0033 → #4a0080), 200 twinkling stars, floating candles with flickering flames, flying owl, magic fog
- Magical Effects: Flying golden snitch (🏅), spell particles (✨), floating wand cursor (🪄), Hogwarts crest rotating
- Spell Book: Brown leather texture with gold border, quotes from Dumbledore
- Game Canvas: 900x600px purple border, wizard character with pointed hat and wand, dark creatures (👻🦇💀🕷️), magical artifacts (🔮⚗️📜💎👑)
- House Points: 4 cards for Gryffindor (🦁 red), Slytherin (🐍 green), Ravenclaw (🦅 blue), Hufflepuff (🦡 yellow)
- Spells Display: Lumos (⚡), Protego (🛡️), Expecto Patronum (💫), Incendio (🔥) with floating animations
- Mechanics: Arrow/WASD movement, SPACE to cast spells, collect artifacts, avoid enemies, particle effects on collisions
Color Scheme: Gold (#ffd700) accents, purple (#9333ea) magic, dark stone (#1a0033) background, cream text (#f4e4c1)
Typography: Cinzel/MedievalSharp medieval fonts, large elegant headings, magic-themed styling
Layout: Centered game arena, magic grid background, medieval scroll instructions
Components: Star twinkling, candle floating, snitch flying, spell sparkle, mask floating, fog wave, particle magic
Special: Wand cursor, wizard vs dark creatures, spell casting system, high score tracking with localStorage
`
  },
  {
    id: "money-heist-mission",
    name: "La Casa de Papel Heist",
    description: "Money Heist inspired game with Dali masks, falling euros, vault door, and bank heist mission",
    thumbnail: "https://dummyimage.com/400x300/1a1a1a/e71d27&text=Money+Heist",
    templateFile: "/templates/money-heist-mission.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: La Casa de Papel Bank Heist
- Hero: "LA CASA DE PAPEL" with Passion One font, red (#e71d27) glowing title, "BELLA CIAO" anthem text
- Background: Dark gradient (#1a1a1a → #2d0a0a), 10 falling money bills (💶), 4 alarm lights flashing red, 3 floating Dali masks (🎭), red smoke
- Vault Door: 200px spinning circular vault with radial gradient, golden center with money icon (💰)
- Professor's Plan: Brown box with gold border, famous quote about family, "BELLA CIAO" in pulsing red text
- Game Canvas: 900x600px red border, player in red jumpsuit with Dali mask, police officers (👮), money bags (💰), smoke bombs
- Team Members: Professor (🧠), Tokyo (⚡), Berlin (🎩), Nairobi (🔫), Rio (💻) with roles
- Stats: Money Stolen (€), Time Left (countdown timer), Level, Best Heist - displayed in red gradient cards with shine effect
- Mechanics: Arrow/WASD movement, SPACE for smoke bombs, collect money, avoid police, time limit (3 minutes)
Color Scheme: Red (#e71d27) primary, gold (#ffd700) money, black background, white highlights
Typography: Bebas Neue and Anton bold fonts, Passion One for titles, uppercase styling, wide letter-spacing
Layout: Centered vault container, heist grid background, dramatic spacing
Components: Money fall animation, alarm flash, mask floating, smoke wave, vault spin, shine effect, particle system
Special: 3-minute timer countdown, smoke bomb mechanic to hide from police, euro currency display, localStorage for best heist
`
  },
  {
    id: "squid-game-challenge",
    name: "Squid Game Survival",
    description: "Korean Squid Game themed with red light green light, pink guards, player 456, and survival challenges",
    thumbnail: "https://dummyimage.com/400x300/f8f9fa/e71d27&text=Squid+Game",
    templateFile: "/templates/squid-game-challenge.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Squid Game Korean Survival
- Hero: Korean title "오징어 게임" (Ojingeo Geim) + "SQUID GAME CHALLENGE" with Black Han Sans font, red/green colors
- Background: Light gradient (#f8f9fa → #dee2e6), geometric shapes (circle, triangle, square) in green/pink/red, pink guards walking (💂)
- Special Elements: Giant piggy bank (🏦) with fill animation, red light green light doll (👧) turning head animation
- Prize Box: Green gradient background, "₩45,600,000,000" in gold (#ffd700), "456 PLAYERS • 6 GAMES • 1 WINNER"
- Game Canvas: 900x600px black border, player 456 in green tracksuit, pink guards with geometric masks, obstacles, marbles (🔮)
- Red/Green Light: Circular indicator (50px) showing current light state, affects movement - stop on red or eliminated
- Player Stats: 4 cards numbered (456, 001, 067, 218) showing Score, Lives, Level, Best - with Korean aesthetic
- Games List: 6 cards for Red Light (🚦), Honeycomb (🍬), Tug of War (🪢), Marbles (🔮), Glass Bridge (🌉), Squid Game (🦑) with Korean names
- Mechanics: Arrow/WASD movement, SPACE to jump, freeze on red light, collect marbles, avoid guards and obstacles
Color Scheme: Green (#00A878) tracksuits, pink (#F7A1C4) guards, red (#E71D27) elimination, black/white contrast
Typography: Black Han Sans for titles, Noto Sans KR for Korean text, bold uppercase, wide spacing
Layout: Centered game arena, geometric shapes background, clean Korean design
Components: Shape floating, guard walking, piggy filling, doll turning, light blinking, stat bouncing, shine gradient
Special: Red light green light mechanic (movement penalty), player numbering system (456), Korean language integration, survival gameplay
`
  },
  {
    id: "fitness-gym",
    name: "Iron Fitness",
    description: "Dark energetic fitness gym website with orange fire accents, training programs, and membership tiers",
    thumbnail: "https://dummyimage.com/400x300/000000/ff4500&text=Iron+Fitness",
    templateFile: "/templates/fitness-gym.html",
    category: "Fitness",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Dark Energetic Fitness Gym
- Hero: Full-screen (100vh) black background with orange fire accents, "IRON FITNESS" title (120px Bebas Neue) with pulse glow animation
- Background Effects: Scan line animation moving vertically, 3 horizontal energy lines scaling/fading, repeating gradient patterns
- Animations: 3 floating weights (🏋️💪⚡) rotating 180deg over 15s, pulse glow on title, scan lines translating
- Stats Section: 4 metrics (5000+ Members, 50+ Trainers, 100+ Programs, 24/7 Access) with 80px numbers in Bebas Neue
- Programs Grid: 6 cards in auto-fit grid (min 300px) - Strength Training (💪), HIIT Cardio (🔥), Yoga (🧘), Boxing (🥊), CrossFit (🏃), Nutrition (🍎)
- Trainers: 4 elite coaches (Alex Strong, Sara Power, Zen Master, Mike Fighter) with large emoji icons and overlay info
- Membership Plans: 3 tiers with feature lists
  - Basic $29/month: Gym access 6am-10pm, basic equipment, locker room, monthly assessment
  - Pro $59/month (POPULAR): 24/7 access, all classes, trainer 2x/month, nutrition plan, sauna
  - Elite $99/month: VIP access, unlimited trainer, custom meals, recovery, guest passes, events
- Buttons: Orange gradient CTAs with shine effect animation
Color Scheme: Black (#000) background, orange fire (#ff4500) primary, white text, red accents
Typography: Bebas Neue for titles/numbers, Montserrat for body text, uppercase headings
Layout: Full-width sections, centered content, dramatic spacing, intense energy
Components: Scan line effect, energy flow lines, floating weights, pulse animation, card elevation on hover, shine effects
Special: Energetic fitness theme with intense visual effects, membership tier system with feature comparisons
`
  },
  {
    id: "luxury-hotel",
    name: "Le Grandeur",
    description: "Five-star luxury hotel with elegant gold accents, premium rooms, world-class amenities, and sophisticated design",
    thumbnail: "https://dummyimage.com/400x300/f5f5f0/d4af37&text=Le+Grandeur",
    templateFile: "/templates/luxury-hotel.html",
    category: "Hospitality",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Luxury Hotel Elegance
- Fixed Header: Glass morphism with blur, "LE GRANDEUR" logo (32px Playfair Display gold), nav links (Rooms, Amenities, Gallery, Book Now)
- Hero: Full-screen (100vh) parallax background, shimmer dot pattern moving, 4 floating ornaments (🏛️👑💎🌟) rotating 180deg
- Hero Content: "Welcome to Paradise" subtitle, "Le Grandeur" title (100px gold), description, primary button with ripple effect
- Welcome Section: 2-column grid (1fr 1fr, 100px gap), left "A Legacy of Excellence" text, right large castle emoji (🏰 200px) in gradient box
- Rooms Section: 3 luxury cards in auto-fit grid (min 400px)
  - Deluxe Suite $450/night (🛏️): Panoramic views, king bed, marble bathroom, balcony
  - Royal Suite $850/night (👑): Separate living, premium amenities, butler service
  - Presidential Suite $1,500/night (💎): Private pool, dining room, penthouse views
- Amenities Grid: 6 world-class services (Fine Dining 🍽️, Spa 💆, Pool 🏊, Sports 🎾, Entertainment 🎭, Concierge 🚗)
- Gallery: Masonry grid 4 columns, first item 2x2 (150px emoji), others 1x1 (80px), gradient backgrounds, hover scale
- Booking CTA: Full-width gold (#d4af37) section, white text, "Ready for Your Escape?" (70px), secondary button
- Footer: Dark (#1a1a1a) with gold logo (40px), copyright text
Color Scheme: Gold (#d4af37) primary, cream (#f5f5f0) background, white, dark accents
Typography: Playfair Display serif (elegant headings 60-100px), Lato sans-serif (body), sophisticated letter-spacing
Layout: Fixed parallax, centered content, elegant spacing, 2-column grids
Components: Ornament float/rotate, shimmer translate, card elevation, button ripple, gallery scale, parallax scrolling
Special: Luxury hotel aesthetic with premium room pricing, sophisticated animations, elegant typography system
`
  },
  {
    id: "music-festival",
    name: "Neon Beats Festival",
    description: "Vibrant music festival website with neon colors, sound waves, spinning vinyls, and event schedule",
    thumbnail: "https://dummyimage.com/400x300/0a0a0a/ff0080&text=Neon+Beats",
    templateFile: "/templates/music-festival.html",
    category: "Entertainment",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Neon Music Festival
- Hero: Full-screen centered content, "JUNE 15-17, 2025" date (24px pink neon pulse), "NEON BEATS" title (150px Righteous) with rainbow gradient
- Background: Fixed gradient animation (45deg pink→purple→blue→cyan) shifting 400% over 15s, opacity 0.15
- Sound Wave Bars: 10 bars at bottom (12px width) bouncing 30-120px height with staggered delays, pink-purple gradient
- Floating Elements: 5 music notes (🎵🎶) floating up 0→100% with rotation, 2 spinning vinyl records (200px) with radial black/pink gradient
- Lineup Grid: 6 headliner cards (auto-fit min 350px) - Neon Pulse (🎤 EDM), Thunder Wave (🎸 Rock), Bass Drop (🎧 Dubstep), Synth Dreams (🎹 Synthwave), Jazz Fusion (🎺), Techno Tribe (🎼 House)
- Schedule Timeline: 3 days (Friday/Saturday/Sunday) with time slots showing artist, time (32px Righteous purple), stage name
- Tickets Section: 3 tiers with featured middle card
  - General $199: 3-day access, main stage, vendors, merchandise
  - VIP $499 (BEST VALUE badge): All VIP perks, lounge, meet & greet, premium merch, fast track
  - Platinum $999: All VIP + backstage, private viewing, luxury amenities, concierge, after parties, parking
- Animations: Gradient shifting, wave bouncing, note floating, vinyl spinning, card elevation, neon pulse, button shine
Color Scheme: Pink (#ff0080) primary, purple (#7928ca), blue (#0070f3), cyan (#00dfd8), black (#0a0a0a) background
Typography: Righteous for titles (comic bold), Rubik for body (300-900 weights), uppercase styling, wide letter-spacing
Layout: Centered content (max-width 1600px, padding 50px), full-width sections, dramatic spacing
Components: Neon text pulse, wave bars, floating notes, spinning vinyls, gradient animation, ticket badges, timeline slots
Special: Music festival theme with sound visualization, event scheduling system, ticket tier comparisons with badge highlights
`
  },
  {
    id: "photography-portfolio",
    name: "Studio Noir",
    description: "Elegant black & white photography portfolio with masonry gallery, cursor spotlight, and minimal aesthetic",
    thumbnail: "https://dummyimage.com/400x300/0d0d0d/ffffff&text=Studio+Noir",
    templateFile: "/templates/photography-portfolio.html",
    category: "Photography",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Minimal Photography Portfolio
- Fixed Header: Glass morphism blur, "STUDIO NOIR" logo (32px Cormorant Garamond), nav (Portfolio, About, Services, Contact)
- Cursor Effect: 500px spotlight following mouse with radial gradient, mix-blend-mode screen, opacity transitions
- Grain Texture: Fixed SVG noise filter overlay (0.05 opacity) for film photography aesthetic
- Hero: Full-screen centered, "Visual Storytelling" subtitle (14px, 8px spacing), "STUDIO NOIR" title (130px Cormorant serif), tagline, CTA button
- Background Shapes: 400px circle (border only) floating/rotating 20s, 300px square (border) rotating 45deg floating 25s
- Portfolio Grid: 12-column masonry layout with varied spans - 10 items with different sizes (1st item: span 7 rows 2, 4th item: span 4 rows 2, 8th item: span 8 rows 2)
- Portfolio Items: Gradient backgrounds (#2a2a2a→#1a1a1a), large emoji placeholders (80px), min-height 400px, hover scale 0.98 & image scale 1.05
- Overlay: Black gradient (to top), opacity 0→1 on hover, title (32px Cormorant), category (12px uppercase)
- About Section: 2-column grid (1fr 1fr, 100px gap), left 3:4 aspect ratio image (📷 150px), right "The Art of Photography" (70px)
- Services Grid: 6 cards (auto-fit min 350px) - Portrait (📸), Commercial (💼), Wedding (💍), Architecture (🏛️), Fine Art (🎨), Editorial (📚)
- Contact: Centered, "Let's Create Together" (80px Cormorant), email (40px bold), social links (Instagram, Behance, Pinterest, LinkedIn)
Color Scheme: Black (#0d0d0d) background, white (#fff) text, subtle grays, minimal contrast
Typography: Cormorant Garamond serif (elegant headings 32-130px), Montserrat sans-serif (body 300-900), letter-spacing emphasis
Layout: Fixed header, centered sections (max-width 1800px, padding 80px), asymmetric masonry grid, white space focus
Components: Cursor spotlight JS, grain texture, shape floating, portfolio overlay fade, card hover effects, service borders
Special: Black & white photography aesthetic, masonry portfolio layout with varied sizes, minimal elegant design, cursor spotlight interaction
`
  },
  {
    id: "travel-agency",
    name: "Wanderlust",
    description: "Adventure travel agency with destination showcases, real travel images, and booking system",
    thumbnail: "https://dummyimage.com/400x300/3b82f6/ffffff&text=Wanderlust",
    templateFile: "/templates/travel-agency.html",
    category: "Travel",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Adventure Travel Agency
- Background: Real travel scene (Unsplash photo-1488646953014-85cb44e25828) with dark overlay (rgba 0,0,0,0.6)
- Fixed Header: Translucent black (0.95) with blur, "WANDERLUST" gradient logo (blue #3b82f6 → cyan #06b6d4), nav links, CTA button
- Floating Elements: 3 clouds (☁️ 80px) drifting left-right 35-45s opacity 0.3, airplane (✈️ 60px) flying 25s rotated -10deg
- Wave Effect: Bottom 200px blue gradient moving 8s ease-in-out scaleY + translateX
- Hero: Full-screen centered, "🌍 Explore The World" (120px Playfair Display), "Your Adventure Begins Here" (28px), fade-in-up staggered 0.3s/0.6s
- Destinations Grid: Auto-fit minmax(400px, 1fr), 6 cards 500px height rounded 20px
  - Paris Eiffel Tower $1,299 (Unsplash photo-1502602898657-3e91760cbb34)
  - Bali Tropical Beach $899 (photo-1493976040374-85c8e12f0c0e)
  - New York Skyline $1,499 (photo-1549144511-f099e773c147)
  - Tokyo Modern City $1,599 (photo-1528164344705-47542687000d)
  - Dubai Architecture $1,799 (photo-1523906834658-6e24ef2386f9)
  - Maldives Overwater $2,299 (photo-1516483638261-f4dbaf036963)
- Card Hover: Elevation (translateY -15px), image zoom (scale 1.1), overlay slides up, book button
- Features: 6 cards (🌟💼🏆✈️🛡️📞) with bouncing icons (translateY -15px over 2s), hover cyan shadow
- Testimonials: Customer review slider, centered layout
- Newsletter: Blue gradient CTA, email input + subscribe button
- Footer: Dark background, logo, links, copyright
Color Scheme: Blue gradient (#3b82f6 → #06b6d4) primary, white text, dark overlays
Typography: Playfair Display serif (elegant 120px titles), Poppins sans-serif (body 300-900)
Layout: Full-screen hero, auto-fit grids, responsive 768px breakpoint
Components: Cloud drift, airplane fly, wave motion, fade-in-up, card elevation, image zoom, bouncing icons
Special: Real Unsplash destination images with gradient overlays, travel pricing display, adventure theme
`
  },
  {
    id: "medical-clinic",
    name: "MediCare Plus",
    description: "Professional medical clinic with doctor profiles, real medical images, and appointment booking",
    thumbnail: "https://dummyimage.com/400x300/06b6d4/ffffff&text=MediCare",
    templateFile: "/templates/medical-clinic.html",
    category: "Healthcare",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Professional Medical Clinic
- Background: Real medical facility (Unsplash photo-1519494026892-80bbd2d6fd0d) with light overlay (rgba 255,255,255,0.95)
- Fixed Header: White translucent (0.95) with blur, "⚕️ MediCare Plus" logo, nav links, appointment button
- Floating Elements: 4 medical icons (💊🩺❤️⚕️ 50px) rotating 180deg over 20s opacity 0.1, 2 pulse circles (300px) expanding scale 1.5 fade 4s
- Hero: 2-column grid (1fr 1fr, gap 80px)
  - Left: "Your Health is Our Priority" (70px Merriweather), "Priority" in cyan, description, schedule button, stats (15K+ Patients, 50+ Doctors, 25+ Years)
  - Right: Real doctor consultation (Unsplash photo-1631217868264-e5b90bb7e133) 600px rounded 30px with pulsing 🏥 icon
- Services: 6 cards auto-fit minmax(350px) - Cardiology (❤️), Neurology (🧠), Orthopedics (🦴), Pediatrics (👶), Laboratory (🔬), Emergency (🚑)
- Card Hover: White background, cyan border, elevation (translateY -10px), shadow
- Doctors: 3 cards (300px width) with real photos
  - Dr. Sarah Johnson Cardiologist (Unsplash photo-1612349317150-e413f6a5b16d)
  - Dr. Michael Chen Neurologist (photo-1622253692010-333f2da6031d)
  - Dr. Emily Rodriguez Pediatrician (photo-1594824476967-48c8b964273f)
- Testimonials: 3 patient reviews with emoji avatars (👨👩👴), left cyan border (5px)
- Contact: Cyan gradient section, white text, "📞 Get In Touch" (60px), 3 items (📍📞✉️)
- Footer: Dark (#0f172a) with cyan logo
Color Scheme: Cyan (#06b6d4) primary, white/light gray (#f8fafc) backgrounds, dark text (#1e293b #0f172a)
Typography: Merriweather serif (elegant 60-70px titles), Inter sans-serif (body 300-800)
Layout: Fixed header, 2-column hero, auto-fit grids, gradient backgrounds
Components: Medical icon float/rotate, pulse circles, hero icon pulse, card elevation, doctor hover
Special: Real Unsplash medical/doctor images, professional healthcare aesthetic, stats display, clean design
`
  },
  {
    id: "law-firm",
    name: "Sterling & Associates",
    description: "Professional law firm with practice areas, real attorney images, and consultation booking",
    thumbnail: "https://dummyimage.com/400x300/cba65a/0f172a&text=Law+Firm",
    templateFile: "/templates/law-firm.html",
    category: "Legal",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Professional Corporate Law Firm
- Background: Real office/legal environment (Unsplash photo-1589829545856-d10d557cf95f) with dark overlay (rgba 15,23,42,0.97 / rgba 30,41,59,0.97)
- Fixed Header: Dark background (rgba 15,23,42,0.95) with blur, "⚖️ STERLING & ASSOCIATES" logo (gold #cba65a), nav, consult button
- Floating Elements: Giant justice scale (⚖️ 120px) center balancing 6s rotate(-5deg to 5deg), 3 legal symbols (📜🏛️⚖️ 40px) floating 25s translateY -30px
- Hero: "Excellence in Legal Representation" (90px Playfair Display gold), description, CTA button, stats (98% Success, 500+ Cases Won)
- Practice Areas: 6 cards auto-fit minmax(350px) with shine effect on hover
  - Corporate Law (💼), Civil Litigation (🏛️), Real Estate (🏠), Family Law (👨‍👩‍👧), Criminal Defense (⚡), Tax Law (💰)
- Card Hover: Gold border, elevation (translateY -10px), shadow, shine sweep animation (left -100% to 100%)
- Attorneys: 3 profiles with real photos
  - James Sterling Senior Partner (Unsplash photo-1556157382-97eda2f9e2bf)
  - Victoria Hayes Partner (photo-1573496359142-b8d87734a5a2)
  - Michael Torres Partner (photo-1507003211169-0a1dd7228f2d)
- Achievements: 4 stats (30+ Years, 500+ Cases, 98% Success, 1000+ Clients) with 60px gold numbers (Playfair)
- Contact Form: 2-column grid with gold gradient background (linear #cba65a → #b8954e), inputs + textarea + submit button
- Footer: Dark (#0f172a) with gold logo, copyright
Color Scheme: Gold (#cba65a) accents, navy/dark (#0f172a #1e293b) backgrounds, cream (#f8fafc) text
Typography: Playfair Display serif (elegant 70-90px titles), Lato sans-serif (body), uppercase styling
Layout: Fixed header, full-screen hero, contained sections, elegant professional spacing
Components: Justice scale balance, legal symbol floating, practice card shine sweep, attorney elevation, form grid
Special: Real Unsplash attorney/office images, corporate professional aesthetic, justice theme, consultation form
`
  },
  {
    id: "fashion-boutique",
    name: "Luxe Mode",
    description: "Trendy fashion boutique with collections, real fashion images, and online shopping",
    thumbnail: "https://dummyimage.com/400x300/ec4899/ffffff&text=Luxe+Mode",
    templateFile: "/templates/fashion-boutique.html",
    category: "Fashion",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Trendy Modern Fashion Boutique
- Background: Real fashion scene (Unsplash photo-1490481651871-ab68de25d43d) with light overlay (rgba 255,255,255,0.98 / rgba 250,247,243,0.98)
- Fixed Header: White translucent (0.97) with blur, "LUXE MODE" gradient logo (pink #ec4899 → purple #8b5cf6), nav, shop button
- Floating Elements: 4 fashion icons (👗👠👜💄 60px) floating 20s translateY(-50px) + rotate(15deg), 3 sparkles (4px dots) twinkling scale(0 to 3)
- Hero: 2-column grid (1fr 1fr, gap 80px)
  - Left: "✨ Elevate Your Style" (100px Didot serif gradient), description, explore button
  - Right: Real fashion model (Unsplash photo-1483985988355-763728e1935b) 700px rounded 30px with ✨ pulsing top-right
- Collections Grid: 3 cards in repeat(3, 1fr)
  - Evening Wear (45 items - Unsplash photo-1515886657613-9f3515b0c78f)
  - Casual Chic (62 items - photo-1469334031218-e382a71b716b)
  - Accessories (38 items - photo-1544957992-20514f595d6f)
- Card Hover: Elevation (translateY -20px), image zoom (scale 1.1), overlay slides up
- Featured Products: 4 cards repeat(4, 1fr) with real fashion images
  - Silk Evening Dress $299 (Unsplash photo-1595777457583-95e059d581b8) NEW badge
  - Designer Handbag $189 (photo-1591047139829-d91aecb6caea) SALE badge
  - Luxury Heels $249 (photo-1551488831-00ddcb6c6bd3)
  - Statement Blazer $329 (photo-1509631179647-0177331693ae) HOT badge
- Lookbook: Masonry grid (2fr 1fr 1fr, 400px rows) with real fashion photos spanning different sizes
- Newsletter: Pink-purple gradient (#ec4899 → #8b5cf6), white text, email form with rounded inputs
- Footer: Dark (#1a1a1a) with gradient logo, 4-column grid (About, Shop, Help, Follow Us)
Color Scheme: Pink (#ec4899) primary, purple (#8b5cf6) secondary, white/cream backgrounds, minimal black
Typography: Didot serif (elegant 70-100px titles), Montserrat sans-serif (body 300-700), letter-spacing focus
Layout: Fixed header, 2-column hero, 3-4 column grids, masonry lookbook, rounded borders (15-30px)
Components: Fashion icon float/rotate, sparkle twinkle, hero image pulse, collection zoom, product badges, lookbook hover
Special: Real Unsplash fashion/model images, trendy boutique aesthetic, product pricing with badges, masonry lookbook layout
`
  },
  {
    id: "ai-tech-startup",
    name: "AI Tech Startup",
    description: "Futuristic AI startup with neural network animations, particle effects, and holographic UI elements",
    thumbnail: "https://dummyimage.com/400x300/0ea5e9/ffffff&text=AI+Tech",
    templateFile: "/templates/ai-tech-startup.html",
    category: "Technology",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Futuristic AI Tech Startup
- Background: Deep dark gradient (#0a0a0f → #1a1a2e), 60 floating particles (white/cyan/purple dots 2-4px) with connection lines when close
- Fixed Header: Glass morphism (rgba 10,10,15,0.8) with blur-xl, "🤖 NEURAL AI" gradient logo (cyan #0ea5e9 → purple #7c3aed), nav links, demo button
- Hero: Full-screen centered, "The Future of Intelligence" (120px Orbitron font) gradient text (cyan → purple → pink), neural network animation background
- Neural Network: 15 nodes (40px circles) connected by animated lines with data packets traveling, pulsing glow effects
- Floating Elements: 5 AI icons (🧠💡⚡🔮🎯 80px) with orbital rotation paths, 3 holographic panels (300px) with code snippets scrolling
- Tech Grid: 6 cards auto-fit minmax(350px) with glass morphism
  - Machine Learning (🤖), Natural Language (💬), Computer Vision (👁️), Predictive Analytics (📊), Deep Learning (🧠), Automation (⚙️)
- Card Effects: Holographic border (conic gradient rotating), elevation on hover, inner glow (box-shadow cyan/purple)
- Features Section: 3 columns with animated counters (99.9% Accuracy, 10M+ Predictions, 50ms Response Time)
- Demo Section: Terminal-style interface with typing animation, green text on black, cursor blink
- Pricing: 3 tiers (Starter $99, Pro $299, Enterprise Custom) with AI feature lists
- Animations: Particle float/connect (15s), neural pulse (2s), holographic rotate (8s), data packet travel (3s), counter increment, typing effect
Color Scheme: Cyan (#0ea5e9) primary, purple (#7c3aed) secondary, pink (#ec4899) accents, dark (#0a0a0f) background, white text
Typography: Orbitron futuristic (120px titles), Space Grotesk (body 300-700), monospace for code, uppercase headings
Layout: Full-screen hero, contained sections (max-width 1600px), centered content, sci-fi spacing
Components: Particle system with connections, neural network visualization, holographic panels, glass morphism cards, terminal interface
Special: AI/ML theme with particle physics, neural network animations, holographic UI effects, sci-fi aesthetic
`
  },
  {
    id: "coffee-shop-cozy",
    name: "The Daily Grind",
    description: "Warm cozy coffee shop with steam animations, floating coffee beans, and vintage aesthetic",
    thumbnail: "https://dummyimage.com/400x300/8b4513/fffaf0&text=Coffee+Shop",
    templateFile: "/templates/coffee-shop-cozy.html",
    category: "Food & Beverage",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Warm Cozy Coffee Shop
- Background: Cream to light brown gradient (#fffaf0 → #f5e6d3), coffee stain texture (SVG), wood grain pattern
- Fixed Header: Semi-transparent brown (rgba 139,69,19,0.9) with blur, "☕ THE DAILY GRIND" logo (Pacifico script font), nav links
- Floating Elements: 12 coffee beans (☕ 30px) falling slowly like snow, 3 steam clouds rising from cups (white opacity 0.6 wavey paths)
- Hero: Full-screen, vintage coffee shop illustration background, "Fresh Roasted Daily" (100px Lobster font brown), "Since 1995" subtitle
- Coffee Cup Animation: Large steaming cup (200px ☕) center with 5 steam waves rising (translateY -100px + fade), cup gentle rotation ±5deg
- Menu Section: 3 categories (Coffee ☕, Pastries 🥐, Specials ✨) with handwritten font style
- Signature Drinks Grid: 6 cards repeat(3, 1fr) with vintage paper texture backgrounds
  - Espresso $3.50 (☕), Cappuccino $4.50 (🍵), Latte $4.75 (🥛), Mocha $5.00 (🍫), Americano $3.75 (☕), Cold Brew $4.25 (🧊)
- Card Design: Brown kraft paper texture, handwritten text, coffee ring stains, bean decorations
- Atmosphere: "Cozy Corner" section with armchair emoji (🛋️ 80px), bookshelf (📚), plants (🪴), warm lighting description
- Barista Picks: 3 featured items with polaroid-style frames, tilted angles (-3deg, 2deg, -2deg)
- Hours Display: Chalkboard aesthetic (dark background, chalk font), "OPEN 7AM - 8PM" with decorative borders
- Footer: Dark brown (#3e2723) with cream text, coffee bean pattern, social icons
- Animations: Beans falling (12s linear infinite), steam rising (4s ease-out), cup wiggle (6s), card tilt on hover, bean spin
Color Scheme: Brown (#8b4513) primary, cream (#fffaf0) backgrounds, dark brown (#3e2723) text, warm accents
Typography: Pacifico script (logo 48px), Lobster (titles 80-100px), Lato (body), handwritten style labels
Layout: Fixed header, full-screen hero, 3-column grids, polaroid gallery, cozy spacing
Components: Coffee bean fall animation, steam rise effect, cup rotation, paper texture overlays, polaroid frames, chalkboard style
Special: Coffee shop ambiance with vintage aesthetic, handwritten menu style, steam and bean animations, warm color palette
`
  },
  {
    id: "real-estate-luxury-modern",
    name: "Prime Properties",
    description: "Modern luxury real estate with property showcase, parallax effects, and virtual tour animations",
    thumbnail: "https://dummyimage.com/400x300/1e40af/fbbf24&text=Real+Estate",
    templateFile: "/templates/real-estate-luxury.html",
    category: "Real Estate",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Modern Luxury Real Estate
- Background: Real skyline photo (Unsplash photo-1449844908441-8829872d2607) with parallax scrolling, gradient overlay (rgba 30,64,175,0.85)
- Fixed Header: White translucent (0.95) with blur, "🏢 PRIME PROPERTIES" navy logo, search bar, listings/agents/contact nav
- Hero: 2-column grid (1fr 1fr, gap 60px)
  - Left: "Find Your Dream Home" (90px Playfair Display), "Luxury Living Starts Here" subtitle, search form (location, type, price range)
  - Right: Featured property carousel with real images, price overlay ($2.5M in gold), 3D card rotation on hover
- Floating Elements: 3 location markers (📍 50px) pulsing with ripple effect, 2 keys (🔑 40px) rotating, building icons floating
- Stats Section: 4 animated counters with gold numbers (1,200+ Properties, $2.5B+ Sales, 500+ Agents, 98% Satisfaction)
- Properties Grid: Auto-fit minmax(450px, 1fr) with featured listings
  - Penthouse $2.5M (Unsplash photo-1512917774080-9991f1c4c750) - 3 bed, 2 bath, 2,500 sq ft, Downtown
  - Villa $3.8M (photo-1613490493576-7fde63acd811) - 5 bed, 4 bath, 4,200 sq ft, Beachfront
  - Mansion $5.2M (photo-1600596542815-ffad4c1539a9) - 6 bed, 5 bath, 6,000 sq ft, Hills
  - Condo $890K (photo-1545324418-cc1a3fa10c00) - 2 bed, 2 bath, 1,800 sq ft, City Center
- Property Cards: Real images with gradient overlay (to top black 0.7), parallax on scroll, info panel slides up on hover
- Virtual Tour: 360° icon (🔄) with "Take Virtual Tour" button, VR headset compatibility badge
- Amenities Icons: 15 features (🏊 Pool, 🏋️ Gym, 🅿️ Parking, 🔒 Security, 🌳 Garden, 🎾 Tennis, etc.) with pulse animation
- Agent Section: 3 top agents with professional photos, sales records, contact buttons
- Map Integration: Interactive map placeholder with property markers (gold pins pulsing)
- Mortgage Calculator: Form with sliders for price/down payment/interest, live calculation display
- Footer: Navy (#1e40af) with gold accents, 4-column grid (Properties, Services, Company, Contact)
- Animations: Parallax scrolling (background), marker pulse, key rotation, card 3D transform, counter increment, amenity pulse, property slide
Color Scheme: Navy (#1e40af) primary, gold (#fbbf24) accents, white/light backgrounds, dark overlays
Typography: Playfair Display serif (elegant 70-90px titles), Montserrat sans-serif (body 300-700), professional spacing
Layout: Fixed header, 2-column hero, auto-fit property grids, parallax backgrounds, polished spacing
Components: Parallax scroll effect, 3D card rotation, marker pulse, counter animation, property carousel, info panel slide, map markers
Special: Real estate luxury theme with property showcase, virtual tour features, mortgage calculator, parallax effects, professional polish
`
  },
  {
    id: "crypto-exchange-neon",
    name: "CryptoVault Exchange",
    description: "Neon cyberpunk cryptocurrency exchange with live charts, blockchain visualization, and trading interface",
    thumbnail: "https://dummyimage.com/400x300/0a0a0a/10b981&text=Crypto+Exchange",
    templateFile: "/templates/crypto-exchange.html",
    category: "Finance",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Neon Cyberpunk Cryptocurrency Exchange
- Background: Pitch black (#0a0a0a), 40 hexagon grid elements (border only) with pulse animation, 15 blockchain blocks floating
- Fixed Header: Dark glass (rgba 10,10,10,0.9) with blur, "₿ CRYPTOVAULT" neon green logo, Markets/Trade/Wallet/About nav, Connect Wallet button
- Hero: Full-screen trading terminal aesthetic, "The Future of Finance" (110px Rajdhani bold) neon gradient (green #10b981 → cyan #06b6d4)
- Blockchain Visualization: 20 connected blocks (60px cubes) with 3D perspective, data flow lines animating between them (glowing particles)
- Price Tickers: Top bar with scrolling crypto prices - Bitcoin ₿$45,230 ↑2.5%, Ethereum Ξ$3,120 ↑1.8%, Solana ◎$98 ↓0.5% (live updating animation)
- Chart Section: Large candlestick chart placeholder with green/red bars, SVG line drawing animation, volume bars at bottom
- Crypto Cards Grid: 6 major cryptocurrencies in repeat(3, 1fr)
  - Bitcoin (₿) $45,230 +2.5% (green up arrow, coin spinning)
  - Ethereum (Ξ) $3,120 +1.8% (purple gradient)
  - Solana (◎) $98 -0.5% (red down arrow)
  - Cardano (₳) $0.52 +3.2% (blue)
  - Polkadot (●) $7.85 +1.1% (pink)
  - Chainlink (⬢) $15.20 +4.5% (blue)
- Card Effects: Neon border (box-shadow green/red based on profit/loss), hover elevation, price number flicker, coin icon rotation
- Trading Interface: Mock terminal with buy/sell buttons (green/red), amount input, sliders, order book display
- Features Grid: 6 cards (🔒 Secure Vault, ⚡ Instant Trades, 📊 Advanced Charts, 💰 Low Fees, 🌐 Global Access, 📱 Mobile App)
- Blockchain Network: Animated network graph with 30 nodes connected by glowing lines, data packets traveling along connections
- Security Badges: "2FA Enabled" "Cold Storage" "Bank-Level Encryption" with shield icons and pulse glow
- Market Stats: 24h Volume ($125B), Total Market Cap ($1.8T), Active Traders (2.5M) with animated counters
- Footer: Black (#000) with neon green accents, crypto icons, legal/terms links
- Animations: Hexagon pulse (3s), blockchain block float/rotate (10s), ticker scroll (20s linear), chart line draw (2s), price flicker, coin spin, network pulse
Color Scheme: Green (#10b981) profit, red (#ef4444) loss, cyan (#06b6d4) highlights, gold (#fbbf24) Bitcoin, black (#0a0a0a) background
Typography: Rajdhani bold (futuristic 80-110px titles), Roboto Mono (monospace prices/numbers), Space Grotesk (body), uppercase headings
Layout: Full-screen terminal, 3-column crypto grids, chart focus, cyberpunk spacing
Components: Blockchain network visualization, hexagon grid pulse, price ticker scroll, candlestick chart animation, neon glow effects, coin rotation
Special: Cryptocurrency exchange theme with blockchain visualization, live price tickers, trading terminal interface, neon cyberpunk aesthetic, profit/loss color coding
`
  },
  {
    id: "education-platform-modern",
    name: "EduLearn Academy",
    description: "Clean modern education platform with course cards, instructor profiles, progress tracking, and certificate showcase",
    thumbnail: "https://dummyimage.com/400x300/4f46e5/ffffff&text=Education",
    templateFile: "/templates/education-platform.html",
    category: "Education",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Clean Modern Education Platform
- Background: White/light gradient (#ffffff → #f8fafc), subtle grid pattern, floating book pages, geometric shapes
- Fixed Header: White with subtle shadow, "🎓 EDULEARN ACADEMY" indigo logo (Poppins 600), Courses/Instructors/About/Login nav
- Floating Elements: 5 books (📚 40px) floating with page flip animation, 3 graduation caps (🎓 50px) tossing upward, lightbulb (💡) twinkling
- Hero: 2-column grid (1fr 1fr, gap 80px)
  - Left: "Learn Without Limits" (90px Poppins bold indigo), "10,000+ Courses • Expert Instructors • Lifetime Access", Explore button
  - Right: Illustration of students learning (real image Unsplash photo-1523240795612-9a054b0db644) with floating achievement badges around it
- Stats Section: 4 cards with animated counters (50K+ Students, 1,200+ Courses, 500+ Instructors, 98% Success Rate) with subtle card elevation
- Courses Grid: Auto-fit minmax(380px, 1fr) with 6 featured courses
  - Web Development Bootcamp (💻) $89 - 45 hours, 4.8★, 12,500 students (Unsplash photo-1498050108023-c5249f4df085)
  - Data Science Master (📊) $129 - 60 hours, 4.9★, 8,300 students (photo-1551288049-bebda4e38f71)
  - Digital Marketing Pro (📱) $79 - 35 hours, 4.7★, 15,200 students (photo-1460925895917-afdab827c52f)
  - UI/UX Design (🎨) $99 - 40 hours, 4.8★, 9,800 students (photo-1561070791-2526d30994b5)
  - Business Strategy (💼) $119 - 50 hours, 4.9★, 6,500 students (photo-1454165804606-c3d57bc86b40)
  - Photography Basics (📷) $69 - 30 hours, 4.6★, 11,200 students (photo-1542038784456-1ea8e935640e)
- Course Cards: Real images with rounded corners (16px), gradient overlay, category badge (top-left), hover zoom effect, price tag (bottom-right gold)
- Progress Bars: Animated fill on scroll (0% to target %), gradient fills (indigo → purple)
- Learning Paths: 4 structured journeys (Beginner → Intermediate → Advanced → Expert) with connecting arrows and completion checkmarks
- Instructors Section: 4 top instructors with professional photos in circular frames (200px), names, specialties, student counts
  - Prof. Sarah Chen (Web Dev - 25K students) Unsplash photo-1573497019940-1c28c88b4f3e
  - Dr. Michael Ross (Data Science - 18K) photo-1472099645785-5658abf4ff4e
  - Emily Parker (Design - 22K) photo-1580489944761-15a19d654956
  - David Kumar (Business - 15K) photo-1519085360753-af0119f7cbe7
- Features: 6 cards (📱 Mobile App, 🎥 HD Videos, 📝 Assignments, 🏆 Certificates, 💬 Community, ♾️ Lifetime Access)
- Certificates Showcase: 3 certificate templates with gold seals, shine animation sweeping across, 3D tilt on hover
- Testimonials: Student reviews with star ratings, avatars, course name badges
- Newsletter: Indigo gradient CTA, "Get Free Courses" headline, email input with subscribe button
- Footer: Light gray (#f8fafc) with indigo accents, 4-column grid (Courses, Company, Support, Legal)
- Animations: Book page flip (4s), graduation cap toss (3s), lightbulb twinkle, progress bar fill (1.5s ease-out), certificate shine (6s), card zoom
Color Scheme: Indigo (#4f46e5) primary, purple (#7c3aed) secondary, white/light backgrounds, gold (#fbbf24) accents for pricing/certificates
Typography: Poppins (headings 70-90px, body 300-700), rounded friendly feel, clear hierarchy
Layout: Fixed header, 2-column hero, auto-fit course grids, centered content (max-width 1600px), clean spacing
Components: Progress bar animation, certificate shine effect, book flip, cap toss, star ratings, badges, counters
Special: Education platform theme with course marketplace, instructor profiles, progress tracking, certificate showcase, student testimonials, learning paths
`
  },
  {
    id: "pirates-adventure",
    name: "Pirates of the Caribbean",
    description: "High seas adventure with water effects and swaying ships",
    thumbnail: "https://dummyimage.com/400x300/2c1810/ffffff&text=Pirates",
    templateFile: "/templates/pirates-adventure.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Pirates of the Caribbean Theme
- Hero Section: Parallax ocean waves, swaying Black Pearl ship, treasure map background
- Features Section: 'Cursed Gold' cards with coin spin effects, 'Crew' roster with wanted posters
- Gallery: Telescope view effect, compass navigation
- Typography: 'Pieces of Eight' or rustic serif fonts, gold/parchment colors
- Animations: Water ripple (WebGL), fog rolling in, cannon fire particles, swinging lanterns
- UI: Wood textures, torn paper edges, wax seal buttons
`
  },
  {
    id: "shinchan-fun",
    name: "Shinchan Fun World",
    description: "Playful and colorful cartoon theme with bouncing animations",
    thumbnail: "https://dummyimage.com/400x300/ff0000/ffffff&text=Shinchan",
    templateFile: "/templates/shinchan-fun.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Crayon Shin-chan Cartoon Theme
- Hero Section: Bright primary colors (Red, Yellow, Blue), bouncing Shinchan character, comic bubbles
- Features Section: 'Action Kamen' cards, 'Kasukabe Defense Group' team section
- Gallery: Polaroid style with doodle borders, sticker effects
- Typography: Comic Sans or playful handwritten fonts, bold outlines
- Animations: Bouncing elements, wiggle effects, 'Action Beam' transitions, running Shiro dog
- UI: Rounded corners, thick black borders, crayon texture backgrounds
`
  },
  {
    id: "spiderman-hero",
    name: "Spiderman Hero",
    description: "Action-packed superhero theme with web-swinging effects",
    thumbnail: "https://dummyimage.com/400x300/cc0000/ffffff&text=Spiderman",
    templateFile: "/templates/spiderman-hero.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Spiderman / Marvel Comic Theme
- Hero Section: 3D City skyline parallax, swinging Spiderman, dynamic web layers
- Features Section: 'Spider-Sense' tingling cards, 'Gadgets' showcase with blueprints
- Gallery: Comic book panel layout, halftone pattern overlays
- Typography: 'Bangers' or comic book fonts, italicized action text
- Animations: Web shooting transitions, swinging camera movement, glitch/comic text effects
- UI: Red/Blue/Black scheme, spiderweb background patterns, angular tech borders
`
  },
  {
    id: "got-epic",
    name: "Game of Thrones",
    description: "Epic medieval fantasy with fire and ice effects",
    thumbnail: "https://dummyimage.com/400x300/000000/ffffff&text=GoT",
    templateFile: "/templates/got-epic.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Game of Thrones / Medieval Fantasy
- Hero Section: Iron Throne 3D model, falling snow/ash particles, dragon flight animation
- Features Section: 'Great Houses' sigil cards (Stark, Lannister, Targaryen), 'Night's Watch' oath
- Gallery: Map of Westeros zoom effect, parchment textures
- Typography: 'Cinzel' or medieval serif fonts, metallic gold/silver text
- Animations: Fire breathing dragon, freezing ice overlay, sword clash transitions, map unfolding
- UI: Dark iron textures, gold filigree, stone backgrounds, cinematic lighting
`
  },
  {
    id: "stranger-things-retro",
    name: "Stranger Things",
    description: "80s Sci-Fi horror with neon and upside-down effects",
    thumbnail: "https://dummyimage.com/400x300/000000/ff0000&text=Stranger+Things",
    templateFile: "/templates/stranger-things-retro.html",
    category: "Gaming",
    techStacks: ["react-nextjs", "html-css-js", "vue-nuxt", "angular", "svelte-kit"],
    designPrompt: `
Design Style: Stranger Things / 80s Retro Synthwave
- Hero Section: Neon red logo flicker, 'Upside Down' particle spores, bike silhouette parallax
- Features Section: 'Hawkins Lab' files, 'D&D Party' character cards
- Gallery: Polaroid wall with Christmas lights blinking, VHS glitch effects
- Typography: 'Benguiat' (Title font) and retro sans-serifs, neon glow effects
- Animations: Flickering lights, VHS tracking distortion, spore floating, screen shake
- UI: Dark background, neon red/purple accents, grid lines, retro cassette tape elements
`
  },
];

export const getTemplateById = (id: string): Template | undefined => {
  return templates.find(t => t.id === id);
};

export const getTemplatesByTechStack = (techStack: string): Template[] => {
  return templates.filter(t => t.techStacks.includes(techStack));
};
