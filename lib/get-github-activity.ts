type GitHubEvent = {
  type: string;
  created_at: string;
  repo?: {
    name?: string;
  };
  payload?: {
    action?: string;
    commits?: Array<unknown>;
    pull_request?: {
      merged?: boolean;
      url?: string;
    };
    issue?: {
      pull_request?: unknown;
    };
  };
};

export type RepoActivity = {
  repo: string;
  openedPrs: number;
  mergedPrs: number;
  reviews: number;
  reviewComments: number;
  issuesOpened: number;
  commits: number;
  additions: number;
  deletions: number;
  score: number;
};

type PullRequestSummary = {
  additions?: number;
  deletions?: number;
};

const prCache = new Map<string, Promise<PullRequestSummary | null>>();

async function fetchPullRequestSummary(
  prApiUrl: string
): Promise<PullRequestSummary | null> {
  const cached = prCache.get(prApiUrl);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    try {
      const response = await fetch(prApiUrl, {
        headers: {
          Accept: "application/vnd.github+json",
        },
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as PullRequestSummary;
      return {
        additions: data.additions ?? 0,
        deletions: data.deletions ?? 0,
      };
    } catch {
      return null;
    }
  })();

  prCache.set(prApiUrl, request);
  return request;
}

export async function getRecentGitHubActivity(
  username: string
): Promise<RepoActivity[]> {
  "use cache";

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/events/public?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return [];
    }

    const events = (await response.json()) as GitHubEvent[];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activityByRepo = new Map<string, RepoActivity>();

    const prFetches: { repoName: string; prUrl: string }[] = [];

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
        additions: 0,
        deletions: 0,
        score: 0,
      };

      if (event.type === "PullRequestEvent") {
        if (event.payload?.action === "opened") {
          current.openedPrs += 1;
          if (event.payload.pull_request?.url) {
            prFetches.push({
              repoName: event.repo.name,
              prUrl: event.payload.pull_request.url,
            });
          }
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

      if (event.type === "IssuesEvent" && event.payload?.action === "opened") {
        current.issuesOpened += 1;
      }

      if (event.type === "PullRequestReviewEvent" && event.payload?.action === "submitted") {
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

    const prSummaries = await Promise.all(
      prFetches.map(({ prUrl }) => fetchPullRequestSummary(prUrl))
    );
    for (let i = 0; i < prFetches.length; i++) {
      const summary = prSummaries[i];
      const activity = activityByRepo.get(prFetches[i].repoName);
      if (summary && activity) {
        activity.additions += summary.additions ?? 0;
        activity.deletions += summary.deletions ?? 0;
      }
    }

    for (const current of activityByRepo.values()) {
      current.score =
        current.openedPrs * 3 +
        current.mergedPrs * 5 +
        current.reviews * 2 +
        current.reviewComments +
        current.issuesOpened +
        current.commits +
        Math.min(current.additions + current.deletions, 200);
    }

    return [...activityByRepo.values()]
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  } catch {
    return [];
  }
}
