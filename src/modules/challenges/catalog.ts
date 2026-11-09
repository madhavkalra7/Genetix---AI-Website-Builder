import { challengeSlug, getWeekWindow, pickCatalogIndex } from "./shared";

export interface CatalogChallenge {
    /** Slug base; the weekly slug is `<base>-<isoYear>-w<week>`. */
    base: string;
    title: string;
    /** What to build + judging hints. */
    description: string;
    /** Starter prompt prefilled on the home page. */
    prompt: string;
    /** Credits for 1st place (2nd gets 50%, 3rd 25%). */
    prizeCredits: number;
}

/**
 * Curated rotation. Order matters: the week's challenge is `CATALOG[weekSerial % length]`,
 * so appending is safe but reordering changes which theme future weeks get.
 */
export const CHALLENGE_CATALOG: readonly CatalogChallenge[] = [
    {
        base: "diwali-lights-game",
        title: "Diwali Lights Game",
        description:
            "Build a festive browser game around diyas, rangoli or fireworks. Judged on how fun it is to play for a minute, festive visuals, and sound or particle polish.",
        prompt:
            "Build a Diwali browser game where the player lights diyas before the wind blows them out. Glowing particles, a rangoli-pattern background, a score counter, increasing difficulty, and a 'Happy Diwali' end screen with a replay button.",
        prizeCredits: 100,
    },
    {
        base: "retro-arcade",
        title: "Retro Arcade Week",
        description:
            "Recreate the feel of an 80s arcade cabinet: a single-screen game with pixel art, CRT vibes and a high-score table. Judged on game feel, retro style and replayability.",
        prompt:
            "Build a retro arcade-style game in a single HTML page: pixel-art sprites drawn on canvas, a CRT scanline overlay, chiptune-style sound effects with the Web Audio API, lives, a score, and a local high-score table saved in localStorage.",
        prizeCredits: 100,
    },
    {
        base: "tiny-tools",
        title: "Tiny Tools",
        description:
            "Ship one small, genuinely useful utility that does a single job really well. Judged on usefulness, speed and a clean, focused interface.",
        prompt:
            "Build a tiny, polished web utility: a unit converter for cooking (cups, grams, ml, tablespoons) with instant results as you type, a recent-conversions list, keyboard-friendly inputs and a clean minimal design.",
        prizeCredits: 100,
    },
    {
        base: "portfolio-glow-up",
        title: "Portfolio Glow-up",
        description:
            "Design a personal portfolio you would actually send to a recruiter. Judged on first impression, typography, project presentation and mobile layout.",
        prompt:
            "Build a modern personal portfolio for a frontend developer: an animated hero with name and tagline, a projects grid with hover previews, an about section with skills, a timeline of experience, and a contact form. Dark theme with a subtle gradient glow.",
        prizeCredits: 100,
    },
    {
        base: "cricket-mini-game",
        title: "Cricket Mini-Game",
        description:
            "Make a quick cricket game playable in the browser — batting, bowling or a super-over. Judged on controls, fun and match atmosphere.",
        prompt:
            "Build a cricket batting mini-game: the bowler delivers balls at varying speeds and lines, the player times a swing with the spacebar or a tap, runs are scored by timing quality (1, 2, 4, 6 or out), with a 2-over super-over, a live scoreboard and crowd cheer effects.",
        prizeCredits: 100,
    },
    {
        base: "festival-invite",
        title: "Festival Invite",
        description:
            "Create a beautiful one-page invitation for a festival, wedding or party with RSVP. Judged on design, delight and how easy it is to share.",
        prompt:
            "Build an animated festival invitation website: a hero with the event name and date, a live countdown, venue details with a map link, a schedule of events, a photo gallery and an RSVP form. Warm, celebratory colours and gentle confetti animation.",
        prizeCredits: 100,
    },
    {
        base: "space-week",
        title: "Space Week",
        description:
            "Anything space: a game, an explorer, a solar-system visualiser or a mission landing page. Judged on wow factor, accuracy where it matters and interactivity.",
        prompt:
            "Build an interactive solar system explorer: planets orbiting the sun on a canvas with realistic relative speeds, click a planet to open a panel with facts, a starfield background, and zoom and pause controls.",
        prizeCredits: 100,
    },
    {
        base: "productivity-app",
        title: "Productivity App",
        description:
            "Build a focused productivity app — todo, habit tracker, pomodoro or planner. Judged on usability, persistence (localStorage) and a calm interface.",
        prompt:
            "Build a pomodoro + todo productivity app: a focus timer with work/break cycles and a sound when time is up, a task list where tasks can be tied to pomodoros, daily stats, and everything saved to localStorage. Calm, minimal design.",
        prizeCredits: 100,
    },
    {
        base: "kids-learning-game",
        title: "Kids Learning Game",
        description:
            "Teach something to kids aged 4-10 through play: letters, numbers, shapes or languages. Judged on clarity, encouragement and big, friendly controls.",
        prompt:
            "Build a kids' maths learning game: colourful cartoon-style addition and subtraction questions with big tap-friendly answer buttons, stars for correct answers, gentle encouragement on mistakes, three difficulty levels and a celebration screen.",
        prizeCredits: 100,
    },
    {
        base: "food-stall-website",
        title: "Food Stall Website",
        description:
            "Give a local food stall or cafe a website that makes people hungry. Judged on appetite appeal, menu clarity and how quickly you can find the location and hours.",
        prompt:
            "Build a website for a street food stall selling chaat and momos: a mouth-watering hero, a menu with prices and veg/non-veg tags, today's specials, opening hours, a location map link, customer reviews and a WhatsApp order button.",
        prizeCredits: 100,
    },
    {
        base: "puzzle-week",
        title: "Puzzle Week",
        description:
            "Build a brain-teaser: sliding puzzles, word games, logic grids or a daily puzzle. Judged on the 'one more try' feeling and clean feedback.",
        prompt:
            "Build a daily word puzzle game: guess a 5-letter word in 6 tries with coloured tile feedback, an on-screen keyboard, streak tracking in localStorage, a shareable emoji results summary, and a dark/light toggle.",
        prizeCredits: 100,
    },
    {
        base: "landing-page-sprint",
        title: "Landing Page Sprint",
        description:
            "Design a high-converting landing page for an imaginary startup. Judged on headline clarity, visual hierarchy and a compelling call to action.",
        prompt:
            "Build a landing page for an imaginary AI note-taking startup: a bold hero with a product mockup, a logos strip, three feature sections with illustrations, pricing tiers, testimonials, an FAQ accordion and a sticky call-to-action button.",
        prizeCredits: 100,
    },
    {
        base: "music-maker",
        title: "Music Maker",
        description:
            "Make something that makes sound: a drum machine, a synth, a beat sequencer or a rhythm game. Judged on how good it sounds and how playable it is.",
        prompt:
            "Build a browser drum machine: a 16-step sequencer grid with kick, snare, hi-hat and clap rows using the Web Audio API, tempo control, play/stop, preset patterns and a glowing playhead.",
        prizeCredits: 100,
    },
    {
        base: "fitness-tracker",
        title: "Fitness Tracker",
        description:
            "Help people move more: a workout timer, a steps or water tracker, or a yoga routine guide. Judged on motivation, simplicity and progress visuals.",
        prompt:
            "Build a home workout app: pick a routine (HIIT, stretching, core), follow an exercise-by-exercise timer with rest periods and audio cues, track completed workouts in localStorage, and show a weekly progress chart.",
        prizeCredits: 100,
    },
    {
        base: "travel-guide",
        title: "Travel Guide",
        description:
            "Create a travel guide for a city you love. Judged on storytelling, imagery and practical tips a visitor would actually use.",
        prompt:
            "Build a travel guide website for Jaipur: a full-screen hero, must-see places as cards with short descriptions, a 3-day itinerary, a food section, best time to visit, getting-around tips and a simple budget calculator.",
        prizeCredits: 100,
    },
    {
        base: "pet-paradise",
        title: "Pet Paradise",
        description:
            "Anything for pets and their humans: an adoption page, a virtual pet game or a pet-care planner. Judged on charm and usefulness.",
        prompt:
            "Build a virtual pet game: adopt a cute pixel pet, feed it, play with it and put it to sleep; hunger, happiness and energy bars decay over time and are saved in localStorage; the pet's mood changes its animation.",
        prizeCredits: 100,
    },
    {
        base: "data-dashboard",
        title: "Data Dashboard",
        description:
            "Turn numbers into insight with a dashboard built on sample data. Judged on chart clarity, layout and interactivity (filters, tooltips).",
        prompt:
            "Build a personal finance dashboard with sample data: monthly income vs expenses chart, spending by category donut chart, a filterable transactions table, savings goal progress bars, and a month selector. Clean, card-based layout.",
        prizeCredits: 100,
    },
    {
        base: "racing-game",
        title: "Racing Game",
        description:
            "Build a fast arcade racer — top-down, endless runner or lane dodger. Judged on speed feel, controls on both keyboard and touch, and difficulty curve.",
        prompt:
            "Build a top-down endless car racing game: dodge traffic across three lanes, speed increases over time, collect coins and nitro boosts, keyboard and swipe controls, a distance score and a game-over screen with best score.",
        prizeCredits: 100,
    },
    {
        base: "small-business-site",
        title: "Small Business Site",
        description:
            "Build a site for a local business — salon, tutor, gym or repair shop. Judged on trust signals, clear services and an easy way to book or call.",
        prompt:
            "Build a website for a neighbourhood hair salon: services with prices, stylist profiles, a before/after gallery, customer reviews, opening hours, an appointment booking form and click-to-call and WhatsApp buttons.",
        prizeCredits: 100,
    },
    {
        base: "quiz-show",
        title: "Quiz Show",
        description:
            "Host a quiz: trivia, personality quiz or a 'which X are you?'. Judged on question quality, pacing, feedback and the results screen.",
        prompt:
            "Build a trivia quiz show game: 10 timed multiple-choice questions across categories, a game-show style countdown, lifelines (50:50, skip), animated correct/wrong feedback, a final score with rank title and a share-your-score button.",
        prizeCredits: 100,
    },
];

export interface WeeklyChallengeSpec extends CatalogChallenge {
    slug: string;
    startsAt: Date;
    endsAt: Date;
}

/** The catalog challenge for the week containing `date` (deterministic). */
export function getCatalogChallengeForDate(
    date: Date,
    catalog: readonly CatalogChallenge[] = CHALLENGE_CATALOG
): WeeklyChallengeSpec {
    const item = catalog[pickCatalogIndex(date, catalog.length)]!;
    const { startsAt, endsAt } = getWeekWindow(date);
    return { ...item, slug: challengeSlug(item.base, date), startsAt, endsAt };
}
