// Shared (client + server safe) constants for the community gallery.

export const GALLERY_TITLE_MAX_LENGTH = 60;
export const GALLERY_PAGE_SIZE_MAX = 24;
export const REMIX_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 } as const;
