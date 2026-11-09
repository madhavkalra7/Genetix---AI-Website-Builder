import "server-only";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import type { Readable } from "node:stream";
import { isBlockedIpAddress, StyleDnaUrlError, validateFetchUrl } from "@/lib/style-dna";

/**
 * SSRF-safe GET for Style DNA.
 *
 * - Every URL (initial + each redirect hop) passes validateFetchUrl: http/https only, no
 *   credentials, ports 80/443 only, no internal hostnames, no private IP literals.
 * - DNS is resolved by our own `lookup` hook at connect time; if ANY resolved address is private,
 *   loopback, link-local, CGNAT, multicast, ULA, metadata… the connection is refused. Because the
 *   socket connects to exactly the addresses we validated, DNS rebinding can't swap in an internal IP.
 * - At most 3 redirects, followed manually. 8s hard timeout per request (headers + body).
 * - Decompressed body capped (truncated) at `maxBytes`; only text content types are read.
 */

export type StyleDnaFetchErrorKind = "invalid" | "forbidden" | "blocked" | "unreachable" | "unsupported";

export class StyleDnaFetchError extends Error {
  constructor(
    public readonly kind: StyleDnaFetchErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "StyleDnaFetchError";
  }
}

export const FETCH_TIMEOUT_MS = 8_000;
export const MAX_REDIRECTS = 3;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** dns.lookup replacement that refuses to hand non-public addresses to the socket. */
function safeLookup(hostname: string, options: { family?: number | string; all?: boolean }, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      if (addresses.length === 0) {
        throw Object.assign(new Error(`No addresses for ${hostname}`), { code: "ENOTFOUND" });
      }
      // Reject if ANY address is internal (an attacker could mix public + private records).
      if (addresses.some((a) => isBlockedIpAddress(a.address))) {
        throw new StyleDnaFetchError("forbidden", "That address isn't publicly reachable.");
      }
      const wanted = options.family === 4 || options.family === "IPv4" ? 4 : options.family === 6 || options.family === "IPv6" ? 6 : 0;
      const usable = wanted ? addresses.filter((a) => a.family === wanted) : addresses;
      if (usable.length === 0) {
        throw Object.assign(new Error(`No IPv${wanted} addresses for ${hostname}`), { code: "ENOTFOUND" });
      }
      if (options.all) callback(null, usable);
      else callback(null, usable[0].address, usable[0].family);
    })
    .catch((err: NodeJS.ErrnoException) => callback(err, "", 0));
}

export type SafeFetchKind = "html" | "css";

export type SafeFetchResult = {
  finalUrl: URL;
  contentType: string;
  body: string;
  truncated: boolean;
};

type RawResponse =
  | { type: "redirect"; status: number; location: string }
  | { type: "error"; status: number }
  | { type: "ok"; status: number; contentType: string; body: string; truncated: boolean };

function isAllowedContentType(kind: SafeFetchKind, contentType: string): boolean {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (!ct) return kind === "css"; // some CDNs omit it for CSS
  if (kind === "html") return ct === "text/html" || ct === "application/xhtml+xml";
  return ct.startsWith("text/");
}

function mapNetworkError(err: unknown): StyleDnaFetchError {
  if (err instanceof StyleDnaFetchError) return err;
  const code = (err as NodeJS.ErrnoException | undefined)?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return new StyleDnaFetchError("unreachable", "We couldn't find that website — check the URL.");
  }
  return new StyleDnaFetchError("unreachable", "We couldn't reach that site — try another URL.");
}

function requestOnce(url: URL, kind: SafeFetchKind, maxBytes: number): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        agent: false, // fresh socket → our lookup always runs, no pooled connections to other hosts
        lookup: safeLookup as unknown as http.RequestOptions["lookup"],
        headers: {
          "User-Agent": USER_AGENT,
          Accept: kind === "html" ? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" : "text/css,*/*;q=0.1",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          const location = res.headers.location;
          settle(() => (location ? resolve({ type: "redirect", status, location }) : resolve({ type: "error", status })));
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          settle(() => resolve({ type: "error", status }));
          return;
        }
        const contentType = String(res.headers["content-type"] ?? "");
        if (!isAllowedContentType(kind, contentType)) {
          res.destroy();
          settle(() =>
            reject(new StyleDnaFetchError("unsupported", kind === "html" ? "That URL isn't a web page." : "Not a stylesheet.")),
          );
          return;
        }

        let stream: Readable = res;
        const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding && encoding !== "identity") {
          res.destroy();
          settle(() => reject(new StyleDnaFetchError("unsupported", "Unsupported response encoding.")));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        const finish = (truncated: boolean) =>
          settle(() => {
            resolve({ type: "ok", status, contentType, body: Buffer.concat(chunks).toString("utf8"), truncated });
            res.destroy();
            if (stream !== res) stream.destroy();
          });

        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          const remaining = maxBytes - size;
          if (chunk.length >= remaining) {
            chunks.push(chunk.subarray(0, remaining));
            size = maxBytes;
            finish(true);
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        stream.on("end", () => finish(false));
        stream.on("error", (err) => settle(() => reject(mapNetworkError(err))));
        res.on("error", (err) => settle(() => reject(mapNetworkError(err))));
        res.on("close", () => {
          if (!res.complete) settle(() => reject(new StyleDnaFetchError("unreachable", "The connection was interrupted.")));
        });
      },
    );

    const timer = setTimeout(() => {
      settle(() => reject(new StyleDnaFetchError("unreachable", "That site took too long to respond.")));
      req.destroy();
    }, FETCH_TIMEOUT_MS);

    req.on("error", (err) => settle(() => reject(mapNetworkError(err))));
    req.end();
  });
}

/** GETs a text resource with full SSRF protection. Throws StyleDnaFetchError. */
export async function safeFetchText(input: string | URL, kind: SafeFetchKind, maxBytes: number): Promise<SafeFetchResult> {
  let current: URL;
  try {
    current = validateFetchUrl(input);
  } catch (err) {
    throw new StyleDnaFetchError(
      err instanceof StyleDnaUrlError && /publicly reachable|credentials|ports/.test(err.message) ? "forbidden" : "invalid",
      err instanceof Error ? err.message : "Invalid URL.",
    );
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await requestOnce(current, kind, maxBytes);
    if (res.type === "ok") {
      return { finalUrl: current, contentType: res.contentType, body: res.body, truncated: res.truncated };
    }
    if (res.type === "error") {
      if ([401, 403, 407, 429, 451, 503].includes(res.status)) {
        throw new StyleDnaFetchError("blocked", "That site blocked us — try another URL.");
      }
      throw new StyleDnaFetchError("unreachable", `That site returned an error (${res.status}) — try another URL.`);
    }
    if (hop === MAX_REDIRECTS) break;
    let next: URL;
    try {
      next = validateFetchUrl(new URL(res.location, current));
    } catch (err) {
      throw new StyleDnaFetchError("forbidden", err instanceof Error ? `Redirect refused: ${err.message}` : "Redirect refused.");
    }
    current = next;
  }
  throw new StyleDnaFetchError("unreachable", "That site redirected too many times — try another URL.");
}
