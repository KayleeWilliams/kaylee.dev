import { withMemoryCache } from "./cache";
import { githubHeaders } from "./github-auth";

interface GitHubEvent {
  created_at: string;
  payload?: {
    action?: string;
    commits?: unknown[];
    pull_request?: {
      merged?: boolean;
    };
    issue?: {
      pull_request?: unknown;
    };
  };
  repo?: {
    name?: string;
  };
  type: string;
}

export interface RepoActivity {
  commits: number;
  issuesOpened: number;
  mergedPrs: number;
  openedPrs: number;
  repo: string;
  reviewComments: number;
  reviews: number;
  score: number;
}

const ONE_HOUR = 60 * 60;

export async function getRecentGitHubActivity(
  username: string
): Promise<RepoActivity[]> {
  return await withMemoryCache(
    `github-activity:${username}`,
    ONE_HOUR,
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: GitHub event scoring.
    async () => {
      try {
        const response = await fetch(
          `https://api.github.com/users/${username}/events/public?per_page=100`,
          {
            headers: githubHeaders(),
          }
        );

        if (!response.ok) {
          return [];
        }

        const events = (await response.json()) as GitHubEvent[];
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const activityByRepo = new Map<string, RepoActivity>();

        for (const event of events) {
          if (!event.repo?.name) {
            continue;
          }

          const timestamp = new Date(event.created_at).getTime();
          if (Number.isNaN(timestamp) || timestamp < cutoff) {
            continue;
          }

          const current = activityByRepo.get(event.repo.name) ?? {
            repo: event.repo.name,
            openedPrs: 0,
            mergedPrs: 0,
            reviews: 0,
            reviewComments: 0,
            issuesOpened: 0,
            commits: 0,
            score: 0,
          };

          if (event.type === "PullRequestEvent") {
            if (event.payload?.action === "opened") {
              current.openedPrs += 1;
            }
            if (
              event.payload?.action === "closed" &&
              event.payload.pull_request?.merged
            ) {
              current.mergedPrs += 1;
            }
          }

          if (event.type === "PushEvent") {
            current.commits += event.payload?.commits?.length ?? 0;
          }

          if (
            event.type === "IssuesEvent" &&
            event.payload?.action === "opened"
          ) {
            current.issuesOpened += 1;
          }

          if (
            event.type === "PullRequestReviewEvent" &&
            event.payload?.action === "submitted"
          ) {
            current.reviews += 1;
          }

          if (
            event.type === "PullRequestReviewCommentEvent" &&
            event.payload?.action === "created"
          ) {
            current.reviewComments += 1;
          }

          if (
            event.type === "IssueCommentEvent" &&
            event.payload?.action === "created" &&
            event.payload.issue?.pull_request
          ) {
            current.reviewComments += 1;
          }

          activityByRepo.set(event.repo.name, current);
        }

        for (const current of activityByRepo.values()) {
          current.score =
            current.openedPrs * 3 +
            current.mergedPrs * 5 +
            current.reviews * 2 +
            current.reviewComments +
            current.issuesOpened +
            current.commits;
        }

        return [...activityByRepo.values()]
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);
      } catch {
        return [];
      }
    }
  );
}
