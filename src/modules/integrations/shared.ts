// Client + server safe validation for Supabase credentials.

type Result = { ok: true; value: string } | { ok: false; error: string };

const SUPABASE_HOSTED_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;

/** Hostnames that must never be used (prevents probing internal services from the server). */
function isPrivateHost(hostname: string): boolean {
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
        return true;
    }
    // Any IP literal (v4 or v6) is rejected: real Supabase projects use DNS names.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return true;
    if (!h.includes(".")) return true;
    return false;
}

/**
 * Accepts https://<ref>.supabase.co, or any other public https origin (self-hosted Supabase).
 * Returns the normalized origin without a trailing slash.
 */
export function validateSupabaseUrl(raw: string): Result {
    const value = raw.trim();
    if (!value) return { ok: false, error: "Enter your Supabase project URL" };
    if (SUPABASE_HOSTED_RE.test(value)) {
        return { ok: true, value: value.replace(/\/+$/, "").toLowerCase() };
    }
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { ok: false, error: "Enter a valid URL, e.g. https://abcdefgh.supabase.co" };
    }
    if (url.protocol !== "https:") return { ok: false, error: "The Supabase URL must start with https://" };
    if (url.username || url.password) return { ok: false, error: "The URL must not contain credentials" };
    if (isPrivateHost(url.hostname)) {
        return { ok: false, error: "Use your public Supabase project URL, e.g. https://abcdefgh.supabase.co" };
    }
    if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
        return { ok: false, error: "Use only the project URL (no path), e.g. https://abcdefgh.supabase.co" };
    }
    return { ok: true, value: url.origin };
}

function decodeBase64Url(segment: string): string | null {
    try {
        const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        return atob(padded);
    } catch {
        return null;
    }
}

/** Accepts a legacy anon JWT or a new "sb_publishable_..." key; rejects service_role / secret keys. */
export function validateSupabaseAnonKey(raw: string): Result {
    const value = raw.trim();
    if (!value) return { ok: false, error: "Enter your Supabase anon public key" };

    if (value.startsWith("sb_secret_")) {
        return {
            ok: false,
            error: "That is a secret key. Never share it — use the anon / publishable key instead.",
        };
    }
    if (/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(value)) {
        return { ok: true, value };
    }

    if (value.length < 20 || value.length > 500) {
        return { ok: false, error: "The anon key should be 20-500 characters long" };
    }
    const parts = value.split(".");
    if (parts.length !== 3 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) {
        return { ok: false, error: "That doesn't look like a Supabase anon key (expected a JWT: xxxxx.yyyyy.zzzzz)" };
    }
    const json = decodeBase64Url(parts[1]);
    let payload: unknown = null;
    try {
        payload = json ? JSON.parse(json) : null;
    } catch {
        payload = null;
    }
    if (!payload || typeof payload !== "object") {
        return { ok: false, error: "That doesn't look like a valid Supabase anon key" };
    }
    const role = (payload as { role?: unknown }).role;
    if (role === "service_role") {
        return {
            ok: false,
            error: "This is a service_role key, which bypasses all security. Never use it in a website — paste the anon public key instead.",
        };
    }
    if (role !== undefined && role !== "anon") {
        return { ok: false, error: `Expected an anon key, but this key has role "${String(role)}"` };
    }
    return { ok: true, value };
}
