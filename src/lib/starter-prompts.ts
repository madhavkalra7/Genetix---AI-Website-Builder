// Curated starter prompts for the home page gallery. Each prompt is deliberately specific
// (layout, interactions, colours, edge cases) so a first-time user gets an impressive result.

export const STARTER_CATEGORIES = ["Games", "Tools", "Apps", "Websites", "Fun"] as const;
export type StarterCategory = (typeof STARTER_CATEGORIES)[number];

export interface StarterPrompt {
    id: string;
    title: string;
    category: StarterCategory;
    emoji: string;
    /** One-line card description */
    description: string;
    /** Full prompt placed in the prompt box */
    prompt: string;
    /** Two hex colours for the card's gradient background */
    gradient: [string, string];
    /** Suggested tech stack value (matches the home page selector) */
    techStack?: "html-css-js" | "react-nextjs" | "vue-nuxt" | "angular" | "svelte-kit";
}

export const STARTER_PROMPTS: StarterPrompt[] = [
    {
        id: "neon-snake",
        title: "Neon Snake Arcade",
        category: "Games",
        emoji: "🐍",
        description: "Retro snake with glowing trails and a high-score table.",
        prompt:
            "Build a neon-styled Snake arcade game on an HTML canvas. Dark background with a subtle grid, a glowing cyan snake with a fading trail and pulsing magenta food. Controls: arrow keys and WASD, plus on-screen swipe controls for mobile. The speed increases every 5 points. Show score, best score (saved in localStorage) and a start / pause / game-over overlay with a 'Play again' button. Add small particle bursts when food is eaten and optional sound effects with a mute toggle.",
        gradient: ["#00F5A0", "#00D9F5"],
        techStack: "html-css-js",
    },
    {
        id: "space-shooter",
        title: "Space Shooter",
        category: "Games",
        emoji: "🚀",
        description: "Blast waves of aliens across a parallax starfield.",
        prompt:
            "Create a 2D space shooter game on an HTML canvas. A parallax starfield background, a player ship that moves with arrow keys / mouse and fires with space or click (touch controls on mobile). Waves of enemies with different movement patterns, a boss every 5th wave, power-ups (triple shot, shield, speed), explosions with particles, and screen shake on hits. HUD with score, lives, wave number, and a high score saved in localStorage. Include a polished title screen and a game-over screen.",
        gradient: ["#3A1C71", "#D76D77"],
        techStack: "html-css-js",
    },
    {
        id: "typing-test",
        title: "Typing Speed Test",
        category: "Games",
        emoji: "⌨️",
        description: "Measure WPM and accuracy with live feedback.",
        prompt:
            "Build a typing speed test like Monkeytype. Show a paragraph of random common words; correct characters turn white, mistakes turn red, and a smooth blinking caret follows the cursor. Modes for 15s / 30s / 60s. When time runs out, show WPM, raw WPM, accuracy, and a small line chart of WPM over time. Keep a personal best per mode in localStorage. Minimal dark theme with a yellow accent, keyboard shortcuts (Tab to restart), and fully responsive.",
        gradient: ["#F7971E", "#FFD200"],
        techStack: "html-css-js",
    },
    {
        id: "pomodoro",
        title: "Pomodoro Focus Timer",
        category: "Tools",
        emoji: "🍅",
        description: "Calm focus timer with sessions, breaks and stats.",
        prompt:
            "Create a beautiful Pomodoro focus timer. A large circular progress ring counts down 25-minute focus sessions, 5-minute short breaks and a 15-minute long break after 4 sessions. Start / pause / skip / reset buttons, customisable durations in a settings panel, a gentle chime and browser notification when a session ends, and a small task list where I can pick what I'm working on. Show today's completed sessions and total focus time. Soft gradient background that changes colour between focus and break modes. Save everything in localStorage.",
        gradient: ["#FF512F", "#F09819"],
        techStack: "html-css-js",
    },
    {
        id: "recipe-finder",
        title: "Recipe Finder",
        category: "Tools",
        emoji: "🍜",
        description: "Search recipes by the ingredients you already have.",
        prompt:
            "Build a recipe finder app. I type ingredients I have as chips (e.g. 'eggs', 'tomato', 'rice') and it shows matching recipes from a built-in dataset of at least 20 recipes, ranked by how many ingredients match, with a 'missing ingredients' list for each. Recipe cards with a food image, cooking time, difficulty and diet tags (vegetarian, vegan, gluten-free) with filter toggles. Clicking a card opens a detail view with step-by-step instructions, a serving-size scaler and a 'save to favourites' heart stored in localStorage. Warm, appetising colour palette.",
        gradient: ["#F857A6", "#FF5858"],
        techStack: "html-css-js",
    },
    {
        id: "habit-tracker",
        title: "Habit Tracker",
        category: "Apps",
        emoji: "✅",
        description: "Build streaks with a GitHub-style heatmap.",
        prompt:
            "Create a habit tracker app. Add habits with a name, emoji and colour; check them off each day with a satisfying animation. Show current and longest streaks, a weekly view with checkboxes, and a GitHub-style yearly heatmap per habit. Include a dashboard with completion rate for the week and month, drag-to-reorder habits, edit / archive / delete, and a dark / light theme toggle. Persist everything in localStorage and make it feel like a polished mobile-first app.",
        gradient: ["#11998E", "#38EF7D"],
        techStack: "html-css-js",
    },
    {
        id: "crypto-dashboard",
        title: "Crypto Portfolio Dashboard",
        category: "Apps",
        emoji: "📈",
        description: "Track holdings, P&L and allocation with charts.",
        prompt:
            "Build a crypto portfolio dashboard with a sleek dark fintech design. A sidebar with navigation, a header with total portfolio value and 24h change. Cards for each holding (BTC, ETH, SOL, etc.) with amount, value, average buy price and profit / loss in green or red. Include an area chart of portfolio value over 7D / 1M / 1Y (switchable), a donut chart of allocation, a transactions table with sorting and search, and a form to add a buy or sell transaction. Use realistic mock data and smooth hover states.",
        gradient: ["#4776E6", "#8E54E9"],
        techStack: "react-nextjs",
    },
    {
        id: "bakery",
        title: "Bakery Website",
        category: "Websites",
        emoji: "🥐",
        description: "Cosy bakery site with menu, story and orders.",
        prompt:
            "Design a warm, cosy website for an artisan bakery called 'Golden Crumb'. Hero with a full-width photo of fresh bread, a handwritten-style heading and an 'Order for pickup' button. Sections: our story, a filterable menu (breads, pastries, cakes) with photos and prices, today's specials, customer testimonials, opening hours with a map embed, and an Instagram-style photo grid. Include a simple pickup order form with a date picker. Cream, brown and soft pink palette, rounded shapes and gentle scroll animations. Fully responsive.",
        gradient: ["#C79081", "#DFA579"],
        techStack: "html-css-js",
    },
    {
        id: "photographer-portfolio",
        title: "Portfolio for a Photographer",
        category: "Websites",
        emoji: "📸",
        description: "Minimal, image-first portfolio with a lightbox.",
        prompt:
            "Create an elegant portfolio website for a wedding and travel photographer. Minimal black-and-white layout that lets the photos shine: a full-screen hero slideshow, a masonry gallery filterable by category (weddings, travel, portraits) with a lightbox that supports keyboard and swipe navigation, an about section with a portrait, pricing packages, client testimonials and a contact form with date-of-event field. Use a refined serif font for headings, subtle fade-in animations and lazy-loaded images.",
        gradient: ["#232526", "#7F7F7F"],
        techStack: "html-css-js",
    },
    {
        id: "saas-landing",
        title: "SaaS Landing Page",
        category: "Websites",
        emoji: "💼",
        description: "High-converting landing page for a startup.",
        prompt:
            "Build a modern, high-converting landing page for an AI note-taking SaaS called 'Notely'. Sticky navbar, a bold hero with a gradient headline, product screenshot mockup and two CTAs. Then: a logo cloud of customers, a 3-column features grid with icons, an animated 'how it works' 3-step section, a pricing table with a monthly / yearly toggle, testimonials carousel, FAQ accordion, and a final CTA banner with an email capture. Clean indigo and violet palette, glassmorphism accents, smooth scroll animations, fully responsive.",
        gradient: ["#6A11CB", "#2575FC"],
        techStack: "react-nextjs",
    },
    {
        id: "wedding-invite",
        title: "3D Wedding Invite",
        category: "Fun",
        emoji: "💍",
        description: "An envelope that opens into a 3D invitation.",
        prompt:
            "Create an interactive 3D wedding invitation for 'Aisha & Rohan'. It opens with a sealed envelope; clicking the wax seal flips the flap open with a 3D CSS animation and the card slides out. The card shows names in elegant script, the date with a live countdown, venue with a map link, an event timeline (Mehendi, Sangeet, Wedding, Reception), a photo carousel of the couple and an RSVP form. Floating flower petals in the background, gold and blush colour palette, and soft background music with a play / mute button.",
        gradient: ["#EECDA3", "#EF629F"],
        techStack: "html-css-js",
    },
    {
        id: "birthday-surprise",
        title: "Birthday Surprise Page",
        category: "Fun",
        emoji: "🎂",
        description: "Confetti, candles to blow out and a sweet message.",
        prompt:
            "Make a birthday surprise web page for my best friend Sam. It starts with a 'Tap to open your gift' gift box that shakes and bursts open with confetti. Then show an animated cake with candles that can be blown out by clicking (or by blowing into the microphone if allowed), followed by a typewriter-style heartfelt message, a polaroid-style photo memory wall that you can drag around, and a 'Make a wish' button that launches fireworks. Playful pastel colours, balloons floating up the screen, and a happy-birthday tune with a mute toggle.",
        gradient: ["#FC5C7D", "#6A82FB"],
        techStack: "html-css-js",
    },
];
