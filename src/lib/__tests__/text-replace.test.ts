import { describe, expect, it } from "vitest";
import { replaceTextInFiles } from "@/lib/text-replace";

describe("replaceTextInFiles", () => {
  it("replaces visible HTML text that occurs once", () => {
    const files = { "index.html": "<h1>Welcome to <em>Crumbs</em></h1><p>Fresh bread daily</p>" };
    const r = replaceTextInFiles(files, "Fresh bread daily", "Baked every morning");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.files["index.html"]).toContain("<p>Baked every morning</p>");
  });

  it("tolerates different whitespace/newlines in the source", () => {
    const files = { "index.html": "<p>\n      Fresh   bread\n      daily\n    </p>" };
    const r = replaceTextInFiles(files, "Fresh bread daily", "New text");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.files["index.html"]).toContain("New text");
  });

  it("matches HTML entities and escapes the new text", () => {
    const files = { "index.html": "<p>Tom &amp; Jerry&#39;s cafe</p>" };
    const r = replaceTextInFiles(files, "Tom & Jerry's cafe", "Fish & <Chips>");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.files["index.html"]).toContain("<p>Fish &amp; &lt;Chips&gt;</p>");
  });

  it("refuses when the text appears more than once", () => {
    const files = { "index.html": "<button>Buy</button><button>Buy</button>" };
    expect(replaceTextInFiles(files, "Buy", "Order").ok).toBe(false);
  });

  it("ignores matches inside attributes, scripts, styles and comments", () => {
    const files = {
      "index.html": `<a title="Contact us" href="#">Contact us</a><!-- Contact us --><style>/* Contact us */</style>`,
    };
    const r = replaceTextInFiles(files, "Contact us", "Say hello");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.files["index.html"]).toContain('title="Contact us"');
      expect(r.files["index.html"]).toContain(">Say hello</a>");
    }
  });

  it("falls back to a JS string literal when the text is rendered by script", () => {
    const files = { "index.html": "<div id=s></div>", "script.js": "el.textContent = 'Game over';" };
    const r = replaceTextInFiles(files, "Game over", "You lost!");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.files["script.js"]).toBe("el.textContent = 'You lost!';");
  });

  it("escapes the quote character when replacing inside a JS literal", () => {
    const files = { "script.js": "show('Game over')" };
    const r = replaceTextInFiles(files, "Game over", "It's over");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.files["script.js"]).toBe("show('It\\'s over')");
  });

  it("reports not-found and empty", () => {
    expect(replaceTextInFiles({ "index.html": "<p>Hi</p>" }, "Bye", "x")).toEqual({ ok: false, reason: "not-found" });
    expect(replaceTextInFiles({ "index.html": "<p>Hi</p>" }, "Hi", "   ")).toEqual({ ok: false, reason: "empty" });
  });
});
