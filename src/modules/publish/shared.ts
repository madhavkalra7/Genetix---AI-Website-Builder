// Shared (client + server safe) helpers for one-click publishing.

/** Tech stacks whose generated output is plain static files (CDN libraries, no build/server). */
export const PUBLISHABLE_TECH_STACKS = ["html-css-js", "vue-nuxt", "angular", "svelte-kit"] as const;

export const NOT_PUBLISHABLE_MESSAGE =
    "Publishing is available for HTML/CSS/JS, Vue, Angular and Svelte projects";

export const isPublishableTechStack = (techStack: string | null | undefined): boolean =>
    (PUBLISHABLE_TECH_STACKS as readonly string[]).includes(techStack ?? "");

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

export const RESERVED_SLUGS = new Set([
    "api", "admin", "www", "app", "static", "assets", "auth", "s", "p", "preview",
]);

/** Returns an error message, or null when the slug is valid. */
export function validateSlug(slug: string): string | null {
    if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
        return `Address must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters`;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return "Use only lowercase letters, numbers and hyphens";
    }
    if (slug.startsWith("-") || slug.endsWith("-")) {
        return "Address cannot start or end with a hyphen";
    }
    if (RESERVED_SLUGS.has(slug)) {
        return `"${slug}" is reserved, please choose another address`;
    }
    return null;
}

/** "My Cool Site!" -> "my-cool-site" (trimmed so a suffix still fits). */
export function slugifyName(name: string, maxLength = SLUG_MAX_LENGTH - 7): string {
    return name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength)
        .replace(/-+$/g, "");
}
