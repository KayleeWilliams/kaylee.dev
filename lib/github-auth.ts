import { execSync } from "node:child_process";

let tokenResolved = false;
let cachedToken: string | undefined;

/**
 * Resolves a GitHub token for authenticating API requests.
 *
 * Order:
 *   1. GITHUB_TOKEN / GH_TOKEN env var (works in any environment).
 *   2. In local dev only, the `gh` CLI (`gh auth token`).
 *
 * In production the unauthenticated public API is fine, so we never shell out
 * to `gh` there (the binary isn't available on the host anyway). In dev the
 * constant SSR refreshes burn through the anonymous rate limit, so we
 * authenticate to get the higher ceiling.
 */
function resolveToken(): string | undefined {
  if (tokenResolved) {
    return cachedToken;
  }
  tokenResolved = true;

  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envToken) {
    cachedToken = envToken.trim() || undefined;
    return cachedToken;
  }

  if (import.meta.env.DEV) {
    try {
      cachedToken =
        execSync("gh auth token", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim() || undefined;
    } catch {
      cachedToken = undefined;
    }
  }

  return cachedToken;
}

/**
 * Builds headers for a GitHub API request, adding an Authorization token when
 * one is available. Falls back to unauthenticated headers otherwise.
 */
export function githubHeaders(
  accept = "application/vnd.github+json"
): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept };
  const token = resolveToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
