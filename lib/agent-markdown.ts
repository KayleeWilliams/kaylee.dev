import { getAllExperience } from "@/lib/get-all-experience";
import { getAllProjects } from "@/lib/get-all-projects";
import { getSiteContent } from "@/lib/get-site-content";
import { renderPortfolioMarkdown } from "@/lib/render-portfolio-markdown";
import { pageSeo, type SeoKey } from "@/lib/seo";
import { type Appearance, personConfig, socialConfig } from "@/lib/site-config";
import { formatDate } from "@/lib/utils/format-date";

export type PageKey = SeoKey;

const PAGE_PATHS: Record<PageKey, { path: string; mdPath: string }> = {
  home: { path: "/", mdPath: "/index.md" },
  about: { path: "/about", mdPath: "/about.md" },
  projects: { path: "/projects", mdPath: "/projects.md" },
  connect: { path: "/connect", mdPath: "/connect.md" },
};

const normalizeBase = (base: string) => base.replace(/\/+$/, "");

/** Map an HTML page path to its PageKey, or null if it is not a mirrored page. */
export function pageKeyFromPath(pathname: string): PageKey | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const entry = (
    Object.entries(PAGE_PATHS) as [PageKey, { path: string }][]
  ).find(([, meta]) => meta.path === path);
  return entry ? entry[0] : null;
}

function frontmatter(
  title: string,
  description: string,
  canonicalUrl: string,
  dateModified: string
): string {
  return [
    "---",
    `title: "${title}"`,
    `description: "${description}"`,
    `canonical_url: "${canonicalUrl}"`,
    `last_updated: "${dateModified}"`,
    "---",
    "",
  ].join("\n");
}

function sitemapSection(base: string): string {
  return [
    "## Sitemap",
    "",
    `See [the full sitemap](${base}/sitemap.md) for every page and agent resource.`,
  ].join("\n");
}

async function aboutBody(): Promise<string> {
  const [about, experience] = await Promise.all([
    getSiteContent("about"),
    getAllExperience(),
  ]);
  const appearances = (
    [...(personConfig.appearances ?? [])] as Appearance[]
  ).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const lines: string[] = ["# About", ""];
  if (about) {
    lines.push(about.content.trim(), "");
  }

  lines.push("## Experience", "");
  for (const role of experience) {
    lines.push(
      `### ${role.role} · ${role.company}`,
      "",
      `- ${formatDate(role.startDate)} – ${role.endDate ? formatDate(role.endDate) : "Present"}`,
      ...(role.url ? [`- ${role.url}`] : []),
      `- ${role.description}`,
      ""
    );
  }

  if (appearances.length > 0) {
    lines.push("## Appearances", "");
    for (const item of appearances) {
      lines.push(
        `### ${item.title}`,
        "",
        `- ${item.event}${item.date ? ` · ${formatDate(item.date, "MMM D, YYYY")}` : ""}`,
        ...(item.url ? [`- ${item.url}`] : []),
        ...(item.eventUrl ? [`- ${item.eventUrl}`] : []),
        ""
      );
    }
  }

  return lines.join("\n").trimEnd();
}

async function projectsBody(): Promise<string> {
  const projects = await getAllProjects({ includeStars: true });
  const active = projects
    .filter((project) => project.active)
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));

  const lines: string[] = ["# Projects", ""];
  for (const project of active) {
    lines.push(
      `### ${project.title}`,
      "",
      `- ${project.description}`,
      ...(project.url ? [`- ${project.url}`] : []),
      ...(project.github ? [`- ${project.github}`] : []),
      ...(project.stars
        ? [`- ${project.stars.toLocaleString()} GitHub stars`]
        : []),
      ...(project.tags.length > 0 ? [`- Tags: ${project.tags.join(", ")}`] : []),
      ""
    );
  }
  return lines.join("\n").trimEnd();
}

function connectBody(): string {
  const lines: string[] = [
    "# Connect",
    "",
    `Ways to reach ${personConfig.name}:`,
    "",
  ];
  for (const social of socialConfig) {
    lines.push(`- ${social.name}: ${social.url}`);
  }
  return lines.join("\n").trimEnd();
}

/** Full Markdown mirror of an HTML page: frontmatter + body + sitemap link. */
export async function renderPageMarkdown(
  key: PageKey,
  baseUrl: string
): Promise<string> {
  const base = normalizeBase(baseUrl);
  const { path } = PAGE_PATHS[key];
  const { title, description } = pageSeo[key];
  const dateModified = new Date().toISOString();
  const body =
    key === "home"
      ? (await renderPortfolioMarkdown()).trim()
      : key === "about"
        ? await aboutBody()
        : key === "projects"
          ? await projectsBody()
          : connectBody();

  return `${frontmatter(title, description, `${base}${path}`, dateModified)}${body}\n\n${sitemapSection(base)}\n`;
}

/** 200 Markdown soft-404 for agent requests to unknown pages. */
export function renderNotFoundMarkdown(baseUrl: string): string {
  const base = normalizeBase(baseUrl);
  return `${[
    "# Page not found",
    "",
    "That page does not exist. Available pages:",
    "",
    `- [Home](${base}/) — [markdown](${base}/index.md)`,
    `- [About](${base}/about) — [markdown](${base}/about.md)`,
    `- [Projects](${base}/projects) — [markdown](${base}/projects.md)`,
    `- [Connect](${base}/connect) — [markdown](${base}/connect.md)`,
    "",
    `See [the full sitemap](${base}/sitemap.md).`,
  ].join("\n")}\n`;
}

/** llms.txt — concise index in the llmstxt.org format (links, not full text). */
export function renderLlmsIndex(baseUrl: string): string {
  const base = normalizeBase(baseUrl);
  return `${[
    `# ${personConfig.name}`,
    "",
    "> Founding Engineer at Inth (YC P26) and co-author of c15t, the open-source consent layer. Building open-source compliance infrastructure — consent, data rights, policy evidence, and agent-readable docs.",
    "",
    "## Pages",
    "",
    `- [Home](${base}/index.md): Overview, current work, and selected projects`,
    `- [About](${base}/about.md): Bio, experience, and appearances`,
    `- [Projects](${base}/projects.md): Open-source work — c15t, Cookiebench, DSAR, Leadtype, Joyful`,
    `- [Connect](${base}/connect.md): Social and contact links`,
    "",
    "## More",
    "",
    `- [Full profile](${base}/llms-full.txt): Everything inlined, including live OSS activity`,
    `- [Sitemap](${base}/sitemap.md)`,
  ].join("\n")}\n`;
}

/** llms-full.txt — the entire profile inlined. */
export async function renderLlmsFull(): Promise<string> {
  return renderPortfolioMarkdown();
}

/** sitemap.md — Markdown sitemap mirroring the site hierarchy. */
export function renderSitemapMarkdown(baseUrl: string): string {
  const base = normalizeBase(baseUrl);
  const dateModified = new Date().toISOString();
  return `${[
    "---",
    `title: "Sitemap — ${personConfig.name}"`,
    `canonical_url: "${base}/sitemap.md"`,
    `last_updated: "${dateModified}"`,
    "---",
    "",
    "# Sitemap",
    "",
    "## Pages",
    "",
    `- [Home](${base}/) — [markdown](${base}/index.md)`,
    `- [About](${base}/about) — [markdown](${base}/about.md)`,
    `- [Projects](${base}/projects) — [markdown](${base}/projects.md)`,
    `- [Connect](${base}/connect) — [markdown](${base}/connect.md)`,
    "",
    "## Agent resources",
    "",
    `- [llms.txt](${base}/llms.txt) — index`,
    `- [llms-full.txt](${base}/llms-full.txt) — full profile`,
    `- [AGENTS.md](${base}/AGENTS.md)`,
    `- [sitemap.xml](${base}/sitemap.xml)`,
  ].join("\n")}\n`;
}

/** Markdown HTTP response with canonical Link header and Accept-aware caching. */
export function markdownResponse(
  body: string,
  options: {
    base?: string;
    canonicalPath?: string;
    status?: number;
    contentType?: string;
  } = {}
): Response {
  const { base, canonicalPath, status = 200, contentType = "text/markdown" } =
    options;
  const headers: Record<string, string> = {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    Vary: "Accept",
  };
  if (base && canonicalPath) {
    headers.Link = `<${normalizeBase(base)}${canonicalPath}>; rel="canonical"`;
  }
  return new Response(body, { status, headers });
}
