// Shared (client + server safe) constants for public share links (/share/<shareId>).

export const SHARE_ID_LENGTH = 10;
/** URL-safe alphabet without look-alike characters (no 0/O, 1/l/I) so links survive being read aloud. */
export const SHARE_ID_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

export const SHARE_REMIX_TITLE_MAX_LENGTH = 60;
export const SHARE_REMIX_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 } as const;

export const sharePath = (shareId: string) => `/share/${shareId}`;
