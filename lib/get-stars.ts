import { withMemoryCache } from "./cache";
import { githubHeaders } from "./github-auth";

const GITHUB_URL_PATTERN = /github\.com\/([^/]+)\/([^/]+)/;
const GIT_SUFFIX_PATTERN = /\.git$/;
const ONE_HOUR = 60 * 60;

export async function fetchStars(repoUrl: string): Promise<number | undefined> {
  try {
    const match = repoUrl.match(GITHUB_URL_PATTERN);

    if (!match) {
      return;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(GIT_SUFFIX_PATTERN, "");

    return await withMemoryCache(
      `github-stars:${owner}/${cleanRepo}`,
      ONE_HOUR,
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
      }
    );
  } catch {
    return;
  }
}
