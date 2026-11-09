import { describe, expect, it } from "vitest";
import {
  LANGUAGES,
  PEERJS_CDN_URL,
  VOICE_LANGUAGES,
  buildMultiplayerRequest,
  buildTranslateRequest,
  getLanguage,
  isLanguageCode,
  type LanguageCode,
} from "@/lib/feature-prompts";

const MESSAGE_MAX = 10000; // messages.create input limit

describe("buildMultiplayerRequest", () => {
  const versus = buildMultiplayerRequest({ mode: "versus", maxPlayers: 4 });
  const coop = buildMultiplayerRequest({ mode: "coop", maxPlayers: 2 });

  it("includes the required networking and lobby keywords", () => {
    for (const text of [versus, coop]) {
      expect(text).toContain("ONLINE MULTIPLAYER");
      expect(text).toContain(PEERJS_CDN_URL);
      expect(text).toMatch(/6-character room code/);
      expect(text).toContain("genetix-<gameSlug>-<code>");
      expect(text).toContain("?room=<code>");
      expect(text).toMatch(/QR code/);
      expect(text).toMatch(/Join with code/);
      expect(text).toMatch(/HOST-AUTHORITATIVE/i);
      expect(text).toMatch(/20 times per second/);
      expect(text).toMatch(/interpolat/);
      expect(text).toContain("Online play unavailable — try again");
      expect(text).toMatch(/Rematch/);
      expect(text).toMatch(/Play online/);
      expect(text).toMatch(/touch controls/);
      expect(text).toMatch(/Never block the main game loop/);
      expect(text).toMatch(/audio/i);
      expect(text.length).toBeLessThan(MESSAGE_MAX);
    }
  });

  it("applies mode-specific rules and player count", () => {
    expect(versus).toContain("VERSUS rules");
    expect(versus).not.toContain("CO-OP rules");
    expect(versus).toContain("up to 4 players");
    expect(coop).toContain("CO-OP rules");
    expect(coop).not.toContain("VERSUS rules");
    expect(coop).toContain("up to 2 players");
  });
});

describe("LANGUAGES", () => {
  it("has unique codes and complete metadata", () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const l of LANGUAGES) {
      expect(l.name).toBeTruthy();
      expect(l.nativeName).toBeTruthy();
      expect(l.script).toBeTruthy();
      expect(l.font).toMatch(/^Noto /);
      expect(isLanguageCode(l.code)).toBe(true);
    }
  });

  it("covers the Indian languages first, then world languages", () => {
    const indian: LanguageCode[] = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "ur"];
    const world: LanguageCode[] = ["es", "fr", "de", "ar", "ja", "zh-Hans"];
    expect(LANGUAGES.filter((l) => l.region === "india").map((l) => l.code)).toEqual(indian);
    expect(LANGUAGES.filter((l) => l.region === "world").map((l) => l.code)).toEqual(world);
    const firstWorld = LANGUAGES.findIndex((l) => l.region === "world");
    expect(LANGUAGES.slice(firstWorld).every((l) => l.region === "world")).toBe(true);
  });

  it("marks exactly Urdu and Arabic as RTL with the right fonts", () => {
    expect(LANGUAGES.filter((l) => l.rtl).map((l) => l.code).sort()).toEqual(["ar", "ur"]);
    expect(getLanguage("ur")?.font).toBe("Noto Nastaliq Urdu");
    expect(getLanguage("hi")?.font).toBe("Noto Sans Devanagari");
    expect(getLanguage("pa")?.script).toBe("Gurmukhi");
  });
});

describe("buildTranslateRequest", () => {
  it("includes switcher, data-i18n, fonts, lang and storage requirements", () => {
    const text = buildTranslateRequest(["hi", "ta"], "en");
    expect(text).toContain("English (en)");
    expect(text).toContain("Hindi");
    expect(text).toContain("Tamil");
    expect(text).toContain("data-i18n");
    expect(text).toContain("Noto Sans Devanagari");
    expect(text).toContain("Noto Sans Tamil");
    expect(text).toContain("Google Fonts");
    expect(text).toMatch(/globe button/);
    expect(text).toContain("localStorage");
    expect(text).toContain("navigator.language");
    expect(text).toContain("<html lang=");
    expect(text).toContain("₹");
    expect(text).toMatch(/not word-for-word/);
    expect(text).toMatch(/placeholders/);
    expect(text).toMatch(/aria-labels/);
    expect(text).toMatch(/Nothing else about the design/);
    expect(text.length).toBeLessThan(MESSAGE_MAX);
  });

  it('requires dir="rtl" and Nastaliq font for RTL languages', () => {
    const text = buildTranslateRequest(["ur", "ar"]);
    expect(text).toContain('dir="rtl"');
    expect(text).toContain("Noto Nastaliq Urdu");
    expect(text).toContain("Noto Sans Arabic");
    expect(text).toMatch(/RIGHT-TO-LEFT: for Urdu and Arabic/);
  });

  it("deduplicates languages and skips the original language", () => {
    const text = buildTranslateRequest(["hi", "hi", "bn"], "hi");
    expect(text).toContain("Original language: Hindi (hi)");
    expect(text).not.toMatch(/- Hindi —/);
    expect(text.match(/- Bengali —/g)).toHaveLength(1);
  });

  it("stays under the message limit with every language selected", () => {
    const text = buildTranslateRequest(LANGUAGES.map((l) => l.code));
    expect(text.length).toBeLessThan(MESSAGE_MAX);
  });
});

describe("VOICE_LANGUAGES", () => {
  it("lists Indian speech locales with unique codes, English (India) first", () => {
    const codes = VOICE_LANGUAGES.map((l) => l.code);
    expect(codes[0]).toBe("en-IN");
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of ["hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN", "ur-IN"]) {
      expect(codes).toContain(c);
    }
    for (const l of VOICE_LANGUAGES) expect(l.code).toMatch(/^[a-z]{2}-IN$/);
  });
});
