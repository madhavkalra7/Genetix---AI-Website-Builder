import { describe, expect, it } from "vitest";
import { buildSecurityFixRequest, jwtRole, maskSecret, scanSecurity } from "@/lib/security-scan";

const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const jwt = (payload: object) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.c2lnbmF0dXJlc2lnbmF0dXJl`;

const titles = (files: Record<string, string>) => scanSecurity(files).findings.map((f) => f.title);

describe("scanSecurity", () => {
  it("passes a clean project", () => {
    const result = scanSecurity({
      "index.html": `<html><body><a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a><script src="https://cdn.x.com/a.js"></script></body></html>`,
      "script.js": "document.querySelector('#out').textContent = new URLSearchParams(location.search).get('q');",
      "style.css": "body { color: red; }",
    });
    expect(result.findings).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("detects provider secrets and masks them", () => {
    const openai = "sk-proj-" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4";
    const stripe = "sk_live_" + "51HxYzAbCdEfGhIjKlMnOp";
    const aws = "AKIA" + "ABCDEFGHIJKLMNOP";
    const github = "ghp_" + "a".repeat(18) + "1".repeat(18);
    const google = "AIza" + "SyA1234567890abcdefghijklmnopqrstuv";
    const result = scanSecurity({
      "script.js": [
        `const openai = "${openai}";`,
        `const stripe = '${stripe}';`,
        `const aws = "${aws}";`,
        `const gh = "${github}";`,
        `const maps = "${google}";`,
        `const pem = "-----BEGIN RSA PRIVATE KEY-----";`,
      ].join("\n"),
    });
    const t = result.findings.map((f) => f.title);
    expect(t).toContain("Hard-coded OpenAI API key");
    expect(t).toContain("Hard-coded Stripe secret key");
    expect(t).toContain("Hard-coded AWS access key");
    expect(t).toContain("Hard-coded GitHub token");
    expect(t).toContain("Hard-coded Google API key");
    expect(t).toContain("Hard-coded Private key");
    expect(result.passed).toBe(false);
    const serialized = JSON.stringify(result);
    for (const secret of [openai, stripe, aws, github, google]) expect(serialized).not.toContain(secret);
    expect(serialized).toContain("sk-p…");
    expect(result.findings.find((f) => f.title.includes("AWS"))!.line).toBe(3);
  });

  it("flags Supabase service_role JWTs but not anon keys", () => {
    expect(jwtRole(jwt({ role: "anon" }))).toBe("anon");
    expect(titles({ "app.js": `createClient(url, "${jwt({ role: "anon", iss: "supabase" })}")` })).toEqual([]);
    const result = scanSecurity({ "app.js": `createClient(url, "${jwt({ role: "service_role", iss: "supabase" })}")` });
    expect(result.findings[0]).toMatchObject({ severity: "high", title: "Supabase service_role key exposed", line: 1 });
  });

  it("flags generic secret assignments but ignores placeholders", () => {
    expect(titles({ "app.js": `const apiKey = "q8Zr2LmP0wXv7TnB";` })).toEqual(["Possible hard-coded apikey"]);
    expect(titles({ "app.js": `const password = "hunter2hunter2hunter2";` })).toEqual(["Possible hard-coded password"]);
    expect(titles({ "app.js": `const apiKey = "YOUR_API_KEY_HERE";` })).toEqual([]);
    expect(titles({ "app.js": `const password = "#password-field";` })).toEqual([]);
  });

  it("detects eval, new Function and string timers", () => {
    const t = titles({ "app.js": `eval(code);\nconst f = new Function("a", "return a");\nsetTimeout("run()", 100);\nobj.evaluate(x);` });
    expect(t).toEqual(["Use of eval()", "Use of new Function()", "String passed to setTimeout/setInterval"]);
  });

  it("detects DOM XSS from URL/input values, directly and through a variable", () => {
    expect(titles({ "app.js": `el.innerHTML = location.hash.slice(1);` })).toEqual(["Possible DOM-based XSS"]);
    expect(
      titles({ "app.js": `const q = new URLSearchParams(location.search).get("q");\nresults.innerHTML = "<b>" + q + "</b>";` }),
    ).toEqual(["Possible DOM-based XSS"]);
    expect(titles({ "app.js": `const name = input.value;\nlist.insertAdjacentHTML("beforeend", name);` })).toEqual([
      "Possible DOM-based XSS",
    ]);
    expect(titles({ "app.js": `el.innerHTML = "<p>Static</p>";` })).toEqual([]);
  });

  it("detects mixed content, insecure forms and unsafe target=_blank in HTML", () => {
    const result = scanSecurity({
      "index.html": [
        `<script src="http://cdn.example.com/lib.js"></script>`,
        `<form action="http://api.example.com/signup" method="post"></form>`,
        `<a href="https://x.com" target="_blank">X</a>`,
        `<img src="http://localhost/dev.png">`,
      ].join("\n"),
    });
    expect(result.findings.map((f) => [f.severity, f.title, f.line])).toEqual([
      ["high", "Form submits over http://", 2],
      ["medium", "Insecure http:// resource (mixed content)", 1],
      ["low", 'target="_blank" without rel="noopener"', 3],
    ]);
  });

  it("detects tokens and passwords written to browser storage", () => {
    expect(titles({ "app.js": `localStorage.setItem("authToken", token);` })).toEqual(["Sensitive data in browser storage"]);
    expect(titles({ "app.js": `localStorage.setItem("theme", "dark");` })).toEqual([]);
  });

  it("skips images and normalises paths", () => {
    const result = scanSecurity({
      "/home/user/logo.png": "data:image/png;base64,c2stcHJvai1hYmMxMjM0NTY3ODkwYWJjZGVmZ2hpams=",
      "/home/user/app.js": "eval(x)",
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe("app.js");
  });

  it("only low-severity findings still pass", () => {
    const result = scanSecurity({ "index.html": `<a href="https://x.com" target="_blank">x</a>` });
    expect(result.findings).toHaveLength(1);
    expect(result.passed).toBe(true);
  });

  it("masks and builds a fix request", () => {
    expect(maskSecret("abcdefgh")).toBe("abcd…");
    const { findings } = scanSecurity({ "app.js": "eval(x)" });
    expect(buildSecurityFixRequest(findings)).toContain("1) [medium] Use of eval() in app.js line 1");
    expect(buildSecurityFixRequest([])).toBe("");
  });
});
