import { describe, expect, it } from "vitest";
import { buildStaticHtml, hasStaticEntry, normalizePath, listHtmlPages } from "@/lib/static-html";

const INDEX = `<!DOCTYPE html><html><head><title>t</title><link rel="stylesheet" href="./style.css"></head>
<body><img src="./images/logo.png" alt="logo"><script src="script.js"></script></body></html>`;

describe("buildStaticHtml", () => {
  it("inlines CSS in place of the <link> and JS before </body>", () => {
    const html = buildStaticHtml({
      "/home/user/index.html": INDEX,
      "/home/user/style.css": "body { color: hotpink; }",
      "/home/user/script.js": "console.log('hello');",
    })!;
    expect(html).toBeTruthy();
    expect(html).not.toMatch(/<link[^>]*style\.css/);
    expect(html).toContain('<style data-file="style.css">\nbody { color: hotpink; }\n</style>');
    expect(html).not.toMatch(/<script[^>]*src="script\.js"/);
    expect(html).toContain('<script data-file="script.js">\nconsole.log(\'hello\');\n</script>');
    expect(html.indexOf('data-file="script.js"')).toBeLessThan(html.lastIndexOf("</body>"));
  });

  it("keeps $ sequences (no String.replace patterns) intact", () => {
    const js = "const price = 5; el.textContent = `$${price}`; const re = '$&$1$$';";
    const css = ".a::after { content: '$&'; }";
    const html = buildStaticHtml({ "index.html": INDEX, "script.js": js, "style.css": css })!;
    expect(html).toContain("`$${price}`");
    expect(html).toContain("'$&$1$$'");
    expect(html).toContain("content: '$&'");
  });

  it("escapes </script> inside inlined JS", () => {
    const html = buildStaticHtml({
      "index.html": INDEX,
      "script.js": "document.write('<script>x()</script>'); const s = '</SCRIPT>';",
    })!;
    const inlined = html.slice(html.indexOf('data-file="script.js"'));
    expect(inlined).toContain("<\\/script>");
    // Escape is case-insensitive (the replacement is lowercase, which is still safe)
    expect(inlined).not.toContain("</SCRIPT>");
    // Only the real closing tag of the inlined script remains
    expect(inlined.match(/<\/script>/gi)?.length).toBe(1);
  });

  it("keeps type=module when the original script tag was a module", () => {
    const html = buildStaticHtml({
      "index.html": `<html><head></head><body><script type="module" src="./app.js"></script></body></html>`,
      "app.js": "export {};",
    })!;
    expect(html).toContain('<script type="module" data-file="app.js">');
  });

  it("replaces image references (src and CSS url()) with data URLs", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const html = buildStaticHtml({
      "index.html": INDEX,
      "style.css": ".hero { background: url('images/logo.png'); }",
      "/home/user/images/logo.png": dataUrl,
    })!;
    expect(html).toContain(`<img src="${dataUrl}"`);
    expect(html).toContain(`url('${dataUrl}')`);
    expect(html).not.toContain("images/logo.png");
  });

  it("injects the scrollbar style into <head>", () => {
    const html = buildStaticHtml({ "index.html": INDEX })!;
    expect(html.indexOf("<style data-genetix>")).toBeLessThan(html.indexOf("</head>"));
  });

  it("returns null without an HTML entry", () => {
    expect(buildStaticHtml({ "style.css": "a{}" })).toBeNull();
  });

  it("renders a requested sub page", () => {
    const html = buildStaticHtml({ "index.html": INDEX, "/home/user/about.html": "<html><body>About us</body></html>" }, "./about.html")!;
    expect(html).toContain("About us");
  });
});

describe("hasStaticEntry", () => {
  it("accepts every supported index.html key", () => {
    expect(hasStaticEntry({ "/home/user/index.html": "<html></html>" })).toBe(true);
    expect(hasStaticEntry({ "index.html": "<html></html>" })).toBe(true);
    expect(hasStaticEntry({ "/index.html": "<html></html>" })).toBe(true);
  });

  it("rejects non-static file maps", () => {
    expect(hasStaticEntry({ "app/page.tsx": "export default 1" })).toBe(false);
    expect(hasStaticEntry({ "index.html": 42 })).toBe(false);
    expect(hasStaticEntry(null)).toBe(false);
    expect(hasStaticEntry("index.html")).toBe(false);
  });
});

describe("path helpers", () => {
  it("normalizes paths", () => {
    expect(normalizePath("/home/user/about.html")).toBe("about.html");
    expect(normalizePath("./about.html")).toBe("about.html");
    expect(normalizePath("/about.html")).toBe("about.html");
  });

  it("lists unique html pages", () => {
    expect(listHtmlPages({ "/home/user/index.html": "", "index.html": "", "a.css": "" })).toEqual(["index.html"]);
  });
});
