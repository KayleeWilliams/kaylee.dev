// Discogs asks every client to send a descriptive User-Agent and rewards an
// auth token with a far higher rate limit (60/min vs 25/min) plus access to a
// private collection. We always send the UA; the token is added when present.
const USER_AGENT = "KayleeDevPortfolio/1.0 (+https://www.kaylee.dev)";

let tokenResolved = false;
let cachedToken: string | undefined;

/**
 * Resolves the Discogs personal access token.
 *
 * `process.env` covers Vercel (project env vars); `import.meta.env` covers
 * local dev via a `.env` file. Either is fine, neither is required — without a
 * token the collection still loads for a public profile, just on a tighter
 * rate limit.
 */
function resolveToken(): string | undefined {
  if (tokenResolved) {
    return cachedToken;
  }
  tokenResolved = true;

  const raw =
    process.env.DISCOGS_TOKEN ?? import.meta.env.DISCOGS_TOKEN ?? undefined;
  cachedToken = raw?.trim() || undefined;
  return cachedToken;
}

/**
 * Headers for a Discogs API request: the required User-Agent plus an
 * Authorization token when one is configured.
 */
export function discogsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  const token = resolveToken();
  if (token) {
    headers.Authorization = `Discogs token=${token}`;
  }
  return headers;
}

/** Header set for fetching cover-art binaries (no JSON Accept). */
export function discogsImageHeaders(): Record<string, string> {
  return { "User-Agent": USER_AGENT };
}
