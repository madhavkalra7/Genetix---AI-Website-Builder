// One-click feature requests sent as normal chat build messages (full build, 1 credit).
// Pure string builders — no React / server imports so they stay unit-testable.

// ---------------------------------------------------------------------------
// 1) One-click online multiplayer for games (WebRTC via PeerJS, no backend)
// ---------------------------------------------------------------------------

export type MultiplayerMode = "versus" | "coop";
export type MultiplayerMaxPlayers = 2 | 3 | 4;

export interface MultiplayerOptions {
  mode: MultiplayerMode;
  maxPlayers: MultiplayerMaxPlayers;
}

export const PEERJS_CDN_URL = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
export const QRCODE_CDN_URL = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";

export function buildMultiplayerRequest({ mode, maxPlayers }: MultiplayerOptions): string {
  const players = Math.min(4, Math.max(2, Math.round(maxPlayers))) as MultiplayerMaxPlayers;
  const modeRules =
    mode === "versus"
      ? `VERSUS rules: players compete against each other in the same arena/match. Each player has their own score, lives/health and colour; collisions/hits between players follow the game's existing rules (adapt sensibly, e.g. shared ball, race to a target score, last one standing). The match ends when a player reaches the win condition or only one player is left; the result screen ranks all players (1st, 2nd, …) and highlights the winner.`
      : `CO-OP rules: players play TOGETHER against the game (shared world, shared enemies/obstacles, shared goal). Show a shared team score plus each player's individual contribution. Scale difficulty a little with the number of players. A downed player can be revived or respawns after a short delay; the match ends when the team wins or all players are out. The result screen shows the team result and each player's contribution.`;

  return `Make this game real-time ONLINE MULTIPLAYER (${mode === "versus" ? "Versus" : "Co-op"}, up to ${players} players) using peer-to-peer WebRTC — no backend, no accounts.

KEEP SINGLE-PLAYER: the existing single-player game must keep working exactly as before. Add a clear "Play online" entry/button on the start screen next to the existing play/start option.

NETWORKING (PeerJS, no server of our own):
- Load PeerJS from ${PEERJS_CDN_URL} (global \`Peer\`) and use the free public PeerJS broker (default \`new Peer(id)\` options).
- If PeerJS fails to load or can't connect to the broker (error/timeout ~8s), show a friendly message "Online play unavailable — try again" with a Retry button, and keep local play fully usable. Never throw uncaught errors.

LOBBY:
- "Create room": the host gets a short 6-character room code (uppercase letters/digits, no ambiguous 0/O/1/I). The host's PeerJS id is \`genetix-<gameSlug>-<code>\` where <gameSlug> is a short lowercase slug of this game's name (a-z, 0-9, dashes).
- Show the room code big, a shareable invite link (current page URL with \`?room=<code>\`) with a "Copy" button (navigator.clipboard + fallback), and a QR code of the invite link (use ${QRCODE_CDN_URL} \`QRCode.toCanvas\`, or fall back to an <img> from https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=<encoded link>).
- "Join with code": a text input (auto-uppercase, 6 chars) + Join button.
- Auto-join: if the page URL contains \`?room=<code>\`, skip straight to joining that room.
- Each player picks/gets a name (remember it in localStorage) and a distinct colour. The lobby lists connected players with names, colours and live ping (ms), shows a "Waiting for players…" state, and the host starts the match when ready (at least 2 players; max ${players}; extra joiners get a polite "Room is full" message).

HOST-AUTHORITATIVE MODEL:
- The host runs the authoritative simulation. Guests send INPUTS ONLY (compact messages, e.g. {t:"in", seq, keys/axes, actions}) — guests never decide game outcomes.
- The host broadcasts compact state snapshots about 20 times per second (every ~50 ms; short keys, rounded numbers, only what's needed to render). Include a tick/timestamp.
- Guests render by interpolating between the two latest snapshots (~100 ms buffer) so movement is smooth; the local player's own movement may be predicted for responsiveness.
- Never block the main game loop on the network: send/receive asynchronously, keep requestAnimationFrame running, drop stale messages.
- Measure ping with periodic ping/pong messages and show it in the lobby/HUD.

DISCONNECTS & RECONNECT:
- If a guest disconnects: pause briefly, show "<name> left" and continue with remaining players (or end the match if fewer than 2 remain).
- If the host leaves: end the match for everyone with a clear message and return to the lobby/start screen.
- On a dropped connection, a guest automatically attempts to reconnect to the same room a few times (with backoff) before giving up.

MATCH FLOW:
- Per-player scores in the HUD (name + colour). A match result screen at the end with a "Rematch" button (host restarts with the same players) and "Leave".
- ${modeRules}

CONTROLS & FEEL:
- Keyboard/mouse and mobile touch controls must still work for every player in online mode (each device controls its own player).
- All existing audio, juice and game-feel requirements still apply (sound effects, feedback, animations, responsive layout).

Implement everything inside the existing project files (for a mobile app this stays in the single index.html). Do not remove or break any existing features.`;
}

// ---------------------------------------------------------------------------
// 2) One-click regional languages (India focus)
// ---------------------------------------------------------------------------

export type LanguageCode =
  | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "kn" | "ml" | "pa" | "or" | "ur"
  | "es" | "fr" | "de" | "ar" | "ja" | "zh-Hans";

export interface LanguageInfo {
  code: LanguageCode;
  /** English name */
  name: string;
  /** Name in the language itself */
  nativeName: string;
  script: string;
  /** Google Fonts family that renders this script well */
  font: string;
  rtl: boolean;
  region: "india" | "world";
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari", font: "Noto Sans Devanagari", rtl: false, region: "india" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", script: "Bengali", font: "Noto Sans Bengali", rtl: false, region: "india" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", script: "Tamil", font: "Noto Sans Tamil", rtl: false, region: "india" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", script: "Telugu", font: "Noto Sans Telugu", rtl: false, region: "india" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", script: "Devanagari", font: "Noto Sans Devanagari", rtl: false, region: "india" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati", font: "Noto Sans Gujarati", rtl: false, region: "india" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", font: "Noto Sans Kannada", rtl: false, region: "india" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", font: "Noto Sans Malayalam", rtl: false, region: "india" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi", font: "Noto Sans Gurmukhi", rtl: false, region: "india" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia", font: "Noto Sans Oriya", rtl: false, region: "india" },
  { code: "ur", name: "Urdu", nativeName: "اردو", script: "Arabic (Nastaliq)", font: "Noto Nastaliq Urdu", rtl: true, region: "india" },
  { code: "es", name: "Spanish", nativeName: "Español", script: "Latin", font: "Noto Sans", rtl: false, region: "world" },
  { code: "fr", name: "French", nativeName: "Français", script: "Latin", font: "Noto Sans", rtl: false, region: "world" },
  { code: "de", name: "German", nativeName: "Deutsch", script: "Latin", font: "Noto Sans", rtl: false, region: "world" },
  { code: "ar", name: "Arabic", nativeName: "العربية", script: "Arabic", font: "Noto Sans Arabic", rtl: true, region: "world" },
  { code: "ja", name: "Japanese", nativeName: "日本語", script: "Japanese", font: "Noto Sans JP", rtl: false, region: "world" },
  { code: "zh-Hans", name: "Chinese (Simplified)", nativeName: "简体中文", script: "Simplified Chinese", font: "Noto Sans SC", rtl: false, region: "world" },
];

const LANGUAGE_BY_CODE = new Map<string, LanguageInfo>(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string): LanguageInfo | undefined {
  return LANGUAGE_BY_CODE.get(code);
}

export function isLanguageCode(code: string): code is LanguageCode {
  return LANGUAGE_BY_CODE.has(code);
}

/**
 * @param languages target languages to add (deduplicated, unknown codes ignored)
 * @param defaultLanguage the site's current/original language — a LanguageCode, or e.g. "en"/"English" (default "en")
 */
export function buildTranslateRequest(languages: LanguageCode[], defaultLanguage: string = "en"): string {
  const original = getLanguage(defaultLanguage);
  const originalLabel = original ? `${original.name} (${original.code})` : defaultLanguage === "en" ? "English (en)" : defaultLanguage;
  const targets = Array.from(new Set(languages))
    .map((c) => getLanguage(c))
    .filter((l): l is LanguageInfo => !!l && l.code !== original?.code);

  const list = targets
    .map((l) => `- ${l.name} — ${l.nativeName} (lang="${l.code}", ${l.script} script, font "${l.font}"${l.rtl ? ', RIGHT-TO-LEFT: dir="rtl"' : ""})`)
    .join("\n");
  const fonts = Array.from(new Set(targets.map((l) => l.font)));
  const rtl = targets.filter((l) => l.rtl);

  return `Translate this project into multiple languages with a language switcher. Original language: ${originalLabel}. Add these languages:
${list}

LANGUAGE SWITCHER:
- Add a globe button with a dropdown listing the original language plus every language above, each shown by its native name (e.g. "हिन्दी", "தமிழ்"). Put it in the header/nav for websites; for games and apps use a small floating corner button that never covers gameplay or controls.
- Remember the choice in localStorage. On the first visit, auto-select the best match from navigator.language / navigator.languages (e.g. "hi-IN" → Hindi), otherwise keep the original language.
- Switching is instant (no reload) and keeps the current state (game progress, form input, scroll position).

TRANSLATION QUALITY:
- Translate ALL user-visible text naturally and idiomatically, as a native speaker would write it — not word-for-word. Keep brand names, product names and people's names unchanged.
- Localise numbers, dates, times and currency formats per language with Intl.NumberFormat / Intl.DateTimeFormat (e.g. Indian digit grouping 1,00,000 for Indian languages); keep the ₹ symbol for INR prices.

IMPLEMENTATION:
- Use a JS dictionary object (translations[langCode][key]) and mark every translatable element with a data-i18n="key" attribute. Also translate placeholders (data-i18n-placeholder), aria-labels (data-i18n-aria-label), title attributes (data-i18n-title), the document <title> and meta description.
- Route all dynamic JS strings (scores/HUD text, game-over messages, validation errors, alerts, toasts, confirm dialogs, button labels created in JS) through a t(key, vars) helper so they are translated too.
- Load the matching Noto fonts from Google Fonts for each script (${fonts.map((f) => `"${f}"`).join(", ") || "Noto Sans"}) and apply them with a font-family fallback chain only when that language is active; make sure line-height and button sizes fit longer translations and taller scripts (no clipped or overflowing text).
- Set <html lang="…"> to the active language on every switch.${
    rtl.length > 0
      ? `\n- RIGHT-TO-LEFT: for ${rtl.map((l) => l.name).join(" and ")} set dir="rtl" on <html> (and back to dir="ltr" for others). Layouts must flip correctly — use logical CSS properties (margin-inline-start, padding-inline, inset-inline, text-align: start) and mirror directional icons/arrows; game canvases and numbers stay LTR.`
      : `\n- For any right-to-left language set dir="rtl" on <html> and make the layout flip correctly (logical CSS properties).`
  }

Nothing else about the design, layout, content or behaviour should change. Implement everything inside the existing project files (for a mobile app this stays in the single index.html).`;
}

// ---------------------------------------------------------------------------
// Voice input languages (Web Speech API recognition locales)
// ---------------------------------------------------------------------------

export interface VoiceLanguage {
  code: string;
  label: string;
  /** Short label for the compact trigger */
  short: string;
}

export const VOICE_LANGUAGES: readonly VoiceLanguage[] = [
  { code: "en-IN", label: "English (India)", short: "EN" },
  { code: "hi-IN", label: "हिन्दी · Hindi", short: "हि" },
  { code: "bn-IN", label: "বাংলা · Bengali", short: "বা" },
  { code: "ta-IN", label: "தமிழ் · Tamil", short: "த" },
  { code: "te-IN", label: "తెలుగు · Telugu", short: "తె" },
  { code: "mr-IN", label: "मराठी · Marathi", short: "म" },
  { code: "gu-IN", label: "ગુજરાતી · Gujarati", short: "ગુ" },
  { code: "kn-IN", label: "ಕನ್ನಡ · Kannada", short: "ಕ" },
  { code: "ml-IN", label: "മലയാളം · Malayalam", short: "മ" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ · Punjabi", short: "ਪੰ" },
  { code: "ur-IN", label: "اردو · Urdu", short: "اُ" },
];

export const VOICE_LANG_STORAGE_KEY = "genetix:voice-lang";
