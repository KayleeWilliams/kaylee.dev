import type { RepoActivity } from "./get-github-activity";
import type { InthPost } from "./get-inth-posts";

// Local lower-bound snapshots keep first renders complete when a cold runtime,
// deploy, or third-party API miss happens before Vercel's caches are warm.
export const STAR_SNAPSHOTS: Record<string, number> = {
  "c15t/c15t": 1795,
  "inthhq/cookiebench": 7,
  "inthhq/leadtype": 4,
};

export const NPM_DOWNLOAD_SNAPSHOTS: Record<string, number> = {
  // Deduped c15t + @c15t/core total for 2026-09-30 to 2026-10-29.
  c15t: 1_331_665,
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

// Kaylee's Engineering posts on the Inth blog as of 2026-11-02, shown if the
// feed can't be fetched.
export const INTH_POST_SNAPSHOTS: InthPost[] = [
  {
    title: "We built a cookie banner that makes your scripts start sooner",
    description:
      "A returning visitor's consent is already on the server. c15t now uses it to start their allowed tags from the HTML in Next.js, Nuxt, SvelteKit and TanStack Start, before the page hydrates, without slowing the page down.",
    url: "https://inth.com/blog/cookie-banner-scripts-start-sooner",
    publishedAt: "2026-10-29T16:49:02.000Z",
  },
  {
    title: "How small and fast can a TypeScript CLI get?",
    description:
      "Can a TypeScript CLI match the binary size and startup speed of one written in Zig, Rust, or Go?",
    url: "https://inth.com/blog/how-small-and-fast-can-a-typescript-cli-get",
    publishedAt: "2026-09-24T15:15:59.000Z",
  },
  {
    title: "Inth now has stricter privacy audits and actions",
    description:
      "Inth strengthens privacy audit verification, evidence handling and repair recommendations to help teams make better-supported decisions about what to act on.",
    url: "https://inth.com/blog/changelog-inth-now-has-stricter-privacy-audits-and-more",
    publishedAt: "2026-09-10T14:44:13.000Z",
  },
];
