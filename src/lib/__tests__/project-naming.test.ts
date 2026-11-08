import { describe, expect, it } from "vitest";
import { fallbackProjectName, sanitizeProjectName } from "@/lib/project-naming";

describe("fallbackProjectName", () => {
  it("extracts the subject and skips instruction words", () => {
    expect(fallbackProjectName("use web search and create a habit tracker app")).toBe("Habit Tracker");
    expect(fallbackProjectName("Build a modern responsive website for Pune Bakery")).toBe("Pune Bakery");
  });

  it("suffixes a single keyword by kind", () => {
    expect(fallbackProjectName("make a calculator")).toBe("Calculator Site");
    expect(fallbackProjectName("make a calculator", "app")).toBe("Calculator App");
  });

  it("falls back to a generic name when nothing meaningful is left", () => {
    expect(fallbackProjectName("create a website")).toBe("Web Project");
    expect(fallbackProjectName("", "app")).toBe("Mobile App");
    expect(fallbackProjectName("!!! ??? ...")).toBe("Web Project");
  });

  it("keeps non-ASCII letters", () => {
    expect(fallbackProjectName("crée une boulangerie française")).toBe("Crée Une");
  });
});

describe("sanitizeProjectName", () => {
  it("strips label prefixes, quotes and markdown", () => {
    expect(sanitizeProjectName('Title: "Habit Streak Tracker"')).toBe("Habit Streak Tracker");
    expect(sanitizeProjectName("**Asteroid Dodge**")).toBe("Asteroid Dodge");
    expect(sanitizeProjectName("Project name: <b>Shop</b>")).toBe("bShop/b");
  });

  it("collapses whitespace and newlines", () => {
    expect(sanitizeProjectName("  Kids\n\tAnimal   Memory\r\nGame  ")).toBe("Kids Animal Memory Game");
  });

  it("caps the length at 60 characters", () => {
    const name = sanitizeProjectName("word ".repeat(30));
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name.endsWith(" ")).toBe(false);
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeProjectName("   ")).toBe("");
  });
});
