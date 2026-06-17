import { getAllExperience } from "@/lib/get-all-experience";
import { getAllProjects } from "@/lib/get-all-projects";
import { fetchNpmDownloads } from "@/lib/get-npm-downloads";
import { getSiteContent } from "@/lib/get-site-content";
import { fetchStars } from "@/lib/get-stars";
import { type Appearance, personConfig } from "@/lib/site-config";
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
  const appearances = (
    [...(personConfig.appearances ?? [])] as Appearance[]
  ).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

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
    ...(appearances.length > 0
      ? [
          "## Appearances",
          "",
          ...appearances.flatMap((item) => [
            `### ${item.title}`,
            "",
            `- ${item.event}${item.date ? ` · ${formatDate(item.date, "MMM D, YYYY")}` : ""}`,
            ...(item.url ? [`- ${item.url}`] : []),
            ...(item.eventUrl ? [`- ${item.eventUrl}`] : []),
            "",
          ]),
        ]
      : []),
  ];

  return lines.join("\n").trimEnd().concat("\n");
}
