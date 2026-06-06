import { getAllExperience } from "@/lib/get-all-experience";
import { getAllProjects } from "@/lib/get-all-projects";
import { getRecentGitHubActivity } from "@/lib/get-github-activity";
import { fetchNpmDownloads } from "@/lib/get-npm-downloads";
import { getSiteContent } from "@/lib/get-site-content";
import { fetchStars } from "@/lib/get-stars";
import { personConfig } from "@/lib/site-config";
import { formatDate } from "@/lib/utils/format-date";
import { formatDownloads } from "@/lib/utils/format-downloads";

interface HeroContent {
  currentWork?: string[];
  github?: string;
  npmPackage?: string;
}

export async function renderPortfolioMarkdown(): Promise<string> {
  const [hero, profile, experience, projects] = await Promise.all([
    getSiteContent<HeroContent>("hero"),
    getSiteContent("profile"),
    getAllExperience(),
    getAllProjects(),
  ]);

  const [stars, downloads] =
    hero?.github && hero.npmPackage
      ? await Promise.all([
          fetchStars(hero.github),
          fetchNpmDownloads(hero.npmPackage),
        ])
      : [undefined, undefined];

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const githubUrl = personConfig.sameAs.find((url) =>
    url.includes("github.com/")
  );
  const githubUsername = githubUrl?.split("/").at(-1);
  const contributions = githubUsername
    ? await getRecentGitHubActivity(githubUsername)
    : [];

  const activeProjects = projects.filter((project) => project.active);
  const showProjectsSection =
    activeProjects.length > 0 &&
    !(activeProjects.length === 1 && activeProjects[0]?.slug === "c15t");

  const lines: string[] = [
    `# ${personConfig.name}`,
    "",
    "## Profile",
    "",
    ...(profile ? [profile.content.trim(), ""] : []),
    "## Current Work",
    "",
    ...(hero?.currentWork ? hero.currentWork.map((item) => `- ${item}`) : []),
    ...(stars || downloads
      ? [
          `- c15t snapshot (as of ${snapshotDate}): ${[
            stars ? `${stars.toLocaleString()}+ GitHub stars` : undefined,
            downloads
              ? `${formatDownloads(downloads)}+ monthly npm downloads`
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}`,
        ]
      : []),
    "",
    "## Experience",
    "",
    ...experience.flatMap((item) => [
      `### ${item.role} · ${item.company}`,
      "",
      `- ${formatDate(item.startDate)} - ${item.endDate ? formatDate(item.endDate) : "Present"}`,
      ...(item.url ? [`- ${item.url}`] : []),
      `- ${item.description}`,
      "",
    ]),
    ...(showProjectsSection
      ? [
          "## Projects",
          "",
          ...activeProjects.flatMap((project) => [
            `### ${project.title}`,
            "",
            `- ${project.description}`,
            ...(project.url ? [`- ${project.url}`] : []),
            ...(project.github ? [`- ${project.github}`] : []),
            ...(project.tags.length > 0
              ? [`- Tags: ${project.tags.join(", ")}`]
              : []),
            "",
          ]),
        ]
      : []),
    ...(contributions.length > 0
      ? [
          "## Recent Contributions (last 30 days)",
          "",
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Keep existing markdown metric aggregation intact during framework migration.
          ...contributions.map((repo) => {
            const metrics = [
              repo.openedPrs > 0 ? `${repo.openedPrs} PR opened` : undefined,
              repo.mergedPrs > 0 ? `${repo.mergedPrs} merged` : undefined,
              repo.reviews > 0 ? `${repo.reviews} reviews` : undefined,
              repo.reviewComments > 0
                ? `${repo.reviewComments} comments`
                : undefined,
              repo.issuesOpened > 0 ? `${repo.issuesOpened} issues` : undefined,
              repo.commits > 0 ? `${repo.commits} commits` : undefined,
              repo.additions || repo.deletions
                ? `+${repo.additions.toLocaleString()} / -${repo.deletions.toLocaleString()} lines changed`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ");

            return `- [${repo.repo}](https://github.com/${repo.repo})${metrics ? ` — ${metrics}` : ""}`;
          }),
          "",
        ]
      : []),
  ];

  return lines.join("\n").trimEnd().concat("\n");
}
