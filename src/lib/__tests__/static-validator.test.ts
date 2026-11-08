import { describe, expect, it } from "vitest";
import { validateStaticProject, formatValidationFeedback } from "@/lib/static-validator";

const page = (body: string, head = "") =>
  `<!DOCTYPE html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;

describe("validateStaticProject", () => {
  it("returns [] for a clean multi-file project", () => {
    const issues = validateStaticProject({
      "/home/user/index.html": page(
        `<nav><a href="#about">About</a> <a href="contact.html">Contact</a></nav>
         <section id="about"><button id="go" onclick="start()">Go</button></section>
         <script src="script.js"></script>`,
        `<link rel="stylesheet" href="style.css">`
      ),
      "/home/user/contact.html": page(`<a href="index.html">Home</a>`),
      "/home/user/style.css": "body { color: red; }",
      "/home/user/script.js": `function start() { document.getElementById("go").textContent = "Started"; }`,
    });
    expect(issues).toEqual([]);
  });

  it("asks for an index.html when there is no HTML at all", () => {
    expect(validateStaticProject({ "script.js": "var a = 1;" })).toEqual([
      "No index.html was created. Create index.html as the entry point.",
    ]);
  });

  it("detects JS syntax errors and reports the line number", () => {
    const issues = validateStaticProject({
      "index.html": page(`<script src="app.js"></script>`),
      "app.js": "function ok() {\n  return 1;\n}\nlet x = ;\n",
    });
    const syntax = issues.find((i) => i.includes("JavaScript syntax error in app.js"));
    expect(syntax).toBeDefined();
    expect(syntax).toMatch(/at line 4/);
  });

  it("detects syntax errors in inline scripts", () => {
    const issues = validateStaticProject({
      "index.html": page(`<script>const a = {;</script>`),
    });
    expect(issues.some((i) => i.includes("JavaScript syntax error in index.html <script #1>"))).toBe(true);
  });

  it("adds a hint for truncated files", () => {
    const issues = validateStaticProject({
      "index.html": page(`<script src="app.js"></script>`),
      "app.js": "function cut() {\n  if (true) {\n",
    });
    expect(issues.join("\n")).toMatch(/cut off or has an unclosed/);
  });

  it("flags inline handlers that call undefined functions", () => {
    const issues = validateStaticProject({
      "index.html": page(`<button onclick="startGame()">Play</button><button onclick="alert('hi')">x</button>`),
    });
    expect(issues).toContain("index.html: inline handler calls startGame() but no function named startGame is defined anywhere.");
    expect(issues.some((i) => i.includes("alert()"))).toBe(false);
  });

  it("explains when a handler's function is trapped in module scope", () => {
    const issues = validateStaticProject({
      "index.html": page(
        `<button onclick="launch()">Go</button><script type="module">function launch() { console.log(1); }</script>`
      ),
    });
    expect(issues.some((i) => i.includes("launch()") && i.includes('type="module"'))).toBe(true);
  });

  it("reports links to files that don't exist", () => {
    const issues = validateStaticProject({
      "index.html": page(`<a href="about.html">About</a><img src="./img/logo.png"><a href="https://x.com">x</a>`),
    });
    const missing = issues.find((i) => i.startsWith("index.html references files that don't exist"));
    expect(missing).toBeDefined();
    expect(missing).toContain("about.html");
    expect(missing).toContain("img/logo.png");
    expect(missing).not.toContain("x.com");
  });

  it("reports in-page anchors without a matching id", () => {
    const issues = validateStaticProject({
      "index.html": page(`<a href="#pricing">Pricing</a><a href="#features">F</a><div id="features"></div>`),
    });
    const anchors = issues.find((i) => i.includes("links to sections that don't exist"));
    expect(anchors).toBeDefined();
    expect(anchors).toContain("#pricing");
    expect(anchors).not.toContain("#features");
  });

  it("accepts ids created from JavaScript", () => {
    const issues = validateStaticProject({
      "index.html": page(`<a href="#late">Late</a><script>const d = document.createElement("div"); d.id = "late"; document.body.appendChild(d);</script>`),
    });
    expect(issues.some((i) => i.includes("#late"))).toBe(false);
  });

  it("reports getElementById / querySelector lookups of ids that don't exist", () => {
    const issues = validateStaticProject({
      "index.html": page(`<div id="present"></div><script src="main.js"></script>`),
      "main.js": `document.getElementById("present"); document.getElementById("missingPanel"); document.querySelector("#ghost");`,
    });
    const lookup = issues.find((i) => i.startsWith("JavaScript looks up element ids"));
    expect(lookup).toBeDefined();
    expect(lookup).toContain("#missingPanel");
    expect(lookup).toContain("#ghost");
    expect(lookup).not.toContain("#present");
  });

  const game = {
    "index.html": page(`<canvas id="c"></canvas><div id="score">0</div><script src="game.js"></script>`),
    "game.js": `let score = 0; let player = { x: 0 };
      document.addEventListener("keydown", (e) => { player.x++; });
      function loop() { score++; document.getElementById("score").textContent = score; requestAnimationFrame(loop); }
      requestAnimationFrame(loop);`,
  };

  it("flags games without audio", () => {
    const issues = validateStaticProject(game);
    expect(issues.some((i) => i.startsWith("This is a game but it has no audio"))).toBe(true);
  });

  it("does not require audio when the user asked for no sound", () => {
    const issues = validateStaticProject(game, { userRequest: "make a dodge game with no sound please" });
    expect(issues.some((i) => i.includes("no audio"))).toBe(false);
  });

  it("does not flag games that use the Web Audio API", () => {
    const issues = validateStaticProject({
      ...game,
      "game.js": game["game.js"] + "\nconst ctx = new AudioContext();",
    });
    expect(issues.some((i) => i.includes("no audio"))).toBe(false);
  });

  it("flags bare module imports without an import map", () => {
    const issues = validateStaticProject({
      "index.html": page(`<script type="module">import * as THREE from "three"; console.log(THREE);</script>`),
    });
    expect(issues.some((i) => i.startsWith("Bare module imports (three)"))).toBe(true);
  });

  it("accepts bare module imports when an import map exists", () => {
    const issues = validateStaticProject({
      "index.html": page(
        `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three/build/three.module.js"}}</script>
         <script type="module">import * as THREE from "three"; console.log(THREE);</script>`
      ),
    });
    expect(issues.some((i) => i.includes("Bare module imports"))).toBe(false);
  });

  it("flags extra files in single-file apps", () => {
    const issues = validateStaticProject(
      { "index.html": page(`<p>hi</p>`), "app.js": "var a = 1;" },
      { singleFileApp: true }
    );
    expect(issues.some((i) => i.includes("extra files exist: app.js"))).toBe(true);
  });

  it("formats feedback as a bullet list", () => {
    const text = formatValidationFeedback(["one", "two"]);
    expect(text).toContain("- one\n- two");
  });
});
