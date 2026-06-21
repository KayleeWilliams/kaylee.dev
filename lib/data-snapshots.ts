import type { RepoActivity } from "./get-github-activity";

// Local lower-bound snapshots keep first renders complete when a cold runtime,
// deploy, or third-party API miss happens before Vercel's caches are warm.
export const STAR_SNAPSHOTS: Record<string, number> = {
  "c15t/c15t": 1795,
  "inthhq/cookiebench": 7,
  "inthhq/leadtype": 4,
};

export const NPM_DOWNLOAD_SNAPSHOTS: Record<string, number> = {
  c15t: 195_566,
};

export const GITHUB_ACTIVITY_SNAPSHOTS: Record<string, RepoActivity[]> = {
  KayleeWilliams: [
    {
      repo: "inthhq/leadtype",
      openedPrs: 4,
      mergedPrs: 0,
      reviews: 0,
      reviewComments: 4,
      issuesOpened: 3,
      commits: 0,
      additions: 0,
      deletions: 0,
      score: 19,
    },
    {
      repo: "KayleeWilliams/kaylee.dev",
      openedPrs: 3,
      mergedPrs: 0,
      reviews: 0,
      reviewComments: 0,
      issuesOpened: 0,
      commits: 0,
      additions: 0,
      deletions: 0,
      score: 9,
    },
    {
      repo: "c15t/c15t",
      openedPrs: 2,
      mergedPrs: 0,
      reviews: 0,
      reviewComments: 0,
      issuesOpened: 0,
      commits: 0,
      additions: 0,
      deletions: 0,
      score: 6,
    },
  ],
};
