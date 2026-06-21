import { withMemoryCache } from "./cache";
import { STAR_SNAPSHOTS } from "./data-snapshots";
import { githubHeaders } from "./github-auth";

const GITHUB_URL_PATTERN = /github\.com\/([^/]+)\/([^/]+)/;
const GIT_SUFFIX_PATTERN = /\.git$/;
// Star counts move slowly; cache long so the Runtime Cache (survives deploys)
// serves them without refetching and renders never block on this.
const CACHE_TTL = 24 * 60 * 60;

export async function fetchStars(repoUrl: string): Promise<number | undefined> {
  try {
    const match = repoUrl.match(GITHUB_URL_PATTERN);

    if (!match) {
      return;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(GIT_SUFFIX_PATTERN, "");
    const repoKey = `${owner}/${cleanRepo}`;
    const fallback = STAR_SNAPSHOTS[repoKey.toLowerCase()];

    return await withMemoryCache(
      `github-stars:${repoKey}`,
      CACHE_TTL,
      async () => {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${cleanRepo}`,
          {
            headers: githubHeaders("application/vnd.github.v3+json"),
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        return data.stargazers_count;
      },
      fallback ? { fallback } : undefined
    );
  } catch {
    return;
  }
}
