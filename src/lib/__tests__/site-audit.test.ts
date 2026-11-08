import { describe, expect, it } from "vitest";
import { auditSite, buildAuditFixRequest, parseAttrs } from "@/lib/site-audit";

const GOOD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Bakery – Fresh bread daily</title>
  <meta name="description" content="Acme Bakery bakes sourdough, pastries and cakes fresh every morning in downtown Springfield.">
  <meta property="og:title" content="Acme Bakery">
  <meta property="og:description" content="Fresh bread daily">
  <meta property="og:image" content="https://acme.test/og.png">
  <meta name="theme-color" content="#f59e0b">
  <link rel="icon" href="favicon.svg">
  <link rel="canonical" href="https://acme.test/">
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.example.com/lib.js" defer></script>
</head>
<body>
  <h1>Acme Bakery</h1>
  <h2>Menu</h2>
  <h3>Breads</h3>
  <img src="bread.png" alt="Sourdough loaf">
  <a href="/menu">See the menu</a>
  <a href="https://instagram.com/acme" target="_blank" rel="noopener" aria-label="Instagram"><svg></svg></a>
  <button type="button" aria-label="Open menu"><svg></svg></button>
  <form>
    <label for="email">Email</label><input id="email" type="email">
    <label>Name <input type="text" name="name"></label>
    <input type="hidden" name="x">
    <button type="submit">Send</button>
  </form>
</body>
</html>`;

const BAD = `<html><head>
<script src="app.js"></script>
</head><body>
<h1>One</h1><h1>Two</h1><h4>Skipped</h4>
<img src="a.png">
<a href="/x"><i class="icon"></i></a>
<a href="https://x.com" target="_blank">X</a>
<button><svg></svg></button>
<input type="text" placeholder="Email">
<div onclick="go()">Go</div>
</body></html>`;

const byId = (r: ReturnType<typeof auditSite>, id: string) => r.checks.find((c) => c.id === id)!;

describe("parseAttrs", () => {
  it("parses quoted, unquoted and boolean attributes", () => {
    expect(parseAttrs(` a="1" b='two words' c=3 defer data-x`)).toEqual({ a: "1", b: "two words", c: "3", defer: "", "data-x": "" });
  });
});

describe("auditSite", () => {
  it("passes every check for a well-built page", () => {
    const result = auditSite({ "/home/user/index.html": GOOD, "/home/user/style.css": "body{}" });
    const failing = result.checks.filter((c) => c.status !== "pass");
    expect(failing).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.categoryScores.accessibility).toBe(100);
  });

  it("reports the expected failures for a poor page", () => {
    const result = auditSite({ "index.html": BAD });
    expect(byId(result, "title").status).toBe("fail");
    expect(byId(result, "meta-description").status).toBe("fail");
    expect(byId(result, "viewport").status).toBe("fail");
    expect(byId(result, "lang").status).toBe("fail");
    expect(byId(result, "h1").status).toBe("warn");
    expect(byId(result, "heading-order").status).toBe("warn");
    expect(byId(result, "img-alt").status).toBe("fail");
    expect(byId(result, "link-names").status).toBe("fail");
    expect(byId(result, "button-names").status).toBe("fail");
    expect(byId(result, "form-labels").status).toBe("fail");
    expect(byId(result, "open-graph").status).toBe("fail");
    expect(byId(result, "favicon").status).toBe("warn");
    expect(byId(result, "canonical").status).toBe("warn");
    expect(byId(result, "inline-handlers").status).toBe("warn");
    expect(byId(result, "render-blocking-scripts").status).toBe("warn");
    expect(byId(result, "blank-noopener").status).toBe("warn");
    expect(byId(result, "theme-color").status).toBe("warn");
    expect(result.score).toBeLessThan(30);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("warns on titles and descriptions with the wrong length", () => {
    const html = `<html lang="en"><head><title>Hi</title><meta name="description" content="Too short"></head><body><h1>x</h1></body></html>`;
    const result = auditSite({ "index.html": html });
    expect(byId(result, "title").status).toBe("warn");
    expect(byId(result, "meta-description").status).toBe("warn");
  });

  it("ignores markup inside scripts and comments", () => {
    const html = `<html lang="en"><head></head><body><h1>Hi</h1><!-- <img src="x.png"> --><script>const s = '<img src="y.png"><h1>';</script></body></html>`;
    const result = auditSite({ "index.html": html });
    expect(byId(result, "img-alt").status).toBe("pass");
    expect(byId(result, "h1").status).toBe("pass");
  });

  it("flags embedded images over 300KB", () => {
    const big = "data:image/png;base64," + "A".repeat(500 * 1024);
    const result = auditSite({ "index.html": GOOD, "hero.png": big });
    expect(byId(result, "large-inline-images").status).toBe("warn");
    expect(auditSite({ "index.html": GOOD, "hero.png": "data:image/png;base64,AAAA" }).checks.find((c) => c.id === "large-inline-images")!.status).toBe("pass");
  });

  it("checks element-level rules on every HTML page", () => {
    const result = auditSite({ "index.html": GOOD, "about.html": `<html><body><img src="me.jpg"></body></html>` });
    expect(byId(result, "img-alt").status).toBe("fail");
  });

  it("returns a zero score when there is no HTML", () => {
    const result = auditSite({ "style.css": "body{}" });
    expect(result.score).toBe(0);
    expect(result.checks[0].id).toBe("no-html");
  });

  it("builds a numbered fix request from failing checks only", () => {
    const result = auditSite({ "index.html": BAD });
    const request = buildAuditFixRequest(result.checks);
    expect(request).toMatch(/^Improve SEO & accessibility without changing the design/);
    expect(request).toContain("1) ");
    expect(request).toContain("meta name=\"description\"");
    expect(buildAuditFixRequest(auditSite({ "index.html": GOOD }).checks)).toBe("");
  });
});
