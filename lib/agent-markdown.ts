import { getAllExperience } from "@/lib/get-all-experience";
import { getAllProjects } from "@/lib/get-all-projects";
import { getSiteContent } from "@/lib/get-site-content";
import { renderPortfolioMarkdown } from "@/lib/render-portfolio-markdown";
import { type Appearance, personConfig, socialConfig } from "@/lib/site-config";
import { formatDate } from "@/lib/utils/format-date";

const BASE = personConfig.siteUrl.replace(/\/+$/, "");

export type PageKey = "home" | "about" | "projects" | "connect";

type PageMeta = {
  path: string;
  mdPath: string;
  title: string;
  description: string;
};

const PAGES: Record<PageKey, PageMeta> = {
  home: {
    path: "/",
    mdPath: "/index.md",
    title: `${personConfig.name} — Founding Engineer at Inth, co-author of c15t`,
    description: personConfig.description,
  },
  about: {
    path: "/about",
    mdPath: "/about.md",
    title: "About — Kaylee Williams",
    description:
      "Kaylee Williams is a founding engineer at Inth (YC P26) and co-author of c15t, building open-source consent and privacy infrastructure for developers.",
  },
  projects: {
    path: "/projects",
    mdPath: "/projects.md",
    title: "Projects — Kaylee Williams",
    description:
      "Open-source tools for consent, privacy, and developer experience, built by Kaylee Williams at Inth: c15t, DSAR, Cookiebench, and LeadType.",
  },
  connect: {
    path: "/connect",
    mdPath: "/connect.md",
    title: "Connect — Kaylee Williams",
    description: "Social and contact links for Kaylee Williams.",
  },
};

/** Map an HTML page path to its PageKey, or null if it is not a mirrored page. */
export function pageKeyFromPath(pathname: string): PageKey | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const entry = (Object.entries(PAGES) as [PageKey, PageMeta][]).find(
    ([, meta]) => meta.path === path
  );
  return entry ? entry[0] : null;
}

function frontmatter(meta: PageMeta, dateModified: string): string {
  return [
    "---",
    `title: "${meta.title}"`,
    `description: "${meta.description}"`,
    `url: "${BASE}${meta.path}"`,
    `dateModified: "${dateModified}"`,
    "---",
    "",
  ].join("\n");
}

function sitemapSection(): string {
  return [
    "## Sitemap",
    "",
    `See [the full sitemap](${BASE}/sitemap.md) for every page and agent resource.`,
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
export async function renderPageMarkdown(key: PageKey): Promise<string> {
  const meta = PAGES[key];
  const dateModified = new Date().toISOString();
  const body =
    key === "home"
      ? (await renderPortfolioMarkdown()).trim()
      : key === "about"
        ? await aboutBody()
        : key === "projects"
          ? await projectsBody()
          : connectBody();

  return `${frontmatter(meta, dateModified)}${body}\n\n${sitemapSection()}\n`;
}

/** llms.txt — concise index in the llmstxt.org format (links, not full text). */
export function renderLlmsIndex(): string {
  return `${[
    `# ${personConfig.name}`,
    "",
    "> Founding Engineer at Inth (YC P26) and co-author of c15t, the open-source consent layer. Building open-source compliance infrastructure — consent, data rights, policy evidence, and agent-readable docs.",
    "",
    "## Pages",
    "",
    `- [Home](${BASE}/index.md): Overview, current work, and selected projects`,
    `- [About](${BASE}/about.md): Bio, experience, and appearances`,
    `- [Projects](${BASE}/projects.md): Open-source work — c15t, Cookiebench, DSAR, LeadType, Joyful`,
    `- [Connect](${BASE}/connect.md): Social and contact links`,
    "",
    "## More",
    "",
    `- [Full profile](${BASE}/llms-full.txt): Everything inlined, including live OSS activity`,
    `- [Sitemap](${BASE}/sitemap.md)`,
  ].join("\n")}\n`;
}

/** llms-full.txt — the entire profile inlined. */
export async function renderLlmsFull(): Promise<string> {
  return renderPortfolioMarkdown();
}

/** sitemap.md — Markdown sitemap mirroring the site hierarchy. */
export function renderSitemapMarkdown(): string {
  const dateModified = new Date().toISOString();
  return `${[
    "---",
    `title: "Sitemap — ${personConfig.name}"`,
    `url: "${BASE}/sitemap.md"`,
    `dateModified: "${dateModified}"`,
    "---",
    "",
    "# Sitemap",
    "",
    "## Pages",
    "",
    `- [Home](${BASE}/) — [markdown](${BASE}/index.md)`,
    `- [About](${BASE}/about) — [markdown](${BASE}/about.md)`,
    `- [Projects](${BASE}/projects) — [markdown](${BASE}/projects.md)`,
    `- [Connect](${BASE}/connect) — [markdown](${BASE}/connect.md)`,
    "",
    "## Agent resources",
    "",
    `- [llms.txt](${BASE}/llms.txt) — index`,
    `- [llms-full.txt](${BASE}/llms-full.txt) — full profile`,
    `- [AGENTS.md](${BASE}/AGENTS.md)`,
    `- [sitemap.xml](${BASE}/sitemap.xml)`,
  ].join("\n")}\n`;
}

/** Markdown HTTP response with canonical Link header and Accept-aware caching. */
export function markdownResponse(
  body: string,
  options: { canonicalPath?: string; contentType?: string } = {}
): Response {
  const { canonicalPath, contentType = "text/markdown" } = options;
  const headers: Record<string, string> = {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    Vary: "Accept",
  };
  if (canonicalPath) {
    headers.Link = `<${BASE}${canonicalPath}>; rel="canonical"`;
  }
  return new Response(body, { headers });
}
