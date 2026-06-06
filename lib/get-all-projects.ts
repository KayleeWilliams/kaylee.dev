import { getCollection } from "astro:content";
import type { Project, ProjectFrontmatter } from "@/types/project";
import { fetchStars } from "./get-stars";

const MARKDOWN_EXTENSION_REGEX = /\.md$/;

interface GetAllProjectsOptions {
  includeStars?: boolean;
}

function slugFromId(id: string) {
  return id.replace(MARKDOWN_EXTENSION_REGEX, "");
}

export async function getAllProjects({
  includeStars = true,
}: GetAllProjectsOptions = {}): Promise<Project[]> {
  const entries = await getCollection("projects");
  const projectsWithoutStars = entries.map((entry) => ({
    slug: slugFromId(entry.id),
    content: entry.body ?? "",
    ...(entry.data as ProjectFrontmatter),
  }));

  // Fetch stars for projects that have showStars enabled
  const projects = await Promise.all(
    projectsWithoutStars.map(async (project) => {
      if (includeStars && project.showStars && project.github) {
        const stars = await fetchStars(project.github);
        return { ...project, stars };
      }
      return project;
    })
  );

  return projects.sort((a, b) => {
    if (a.active && !b.active) {
      return -1;
    }
    if (!a.active && b.active) {
      return 1;
    }
    if (a.featured && !b.featured) {
      return -1;
    }
    if (!a.featured && b.featured) {
      return 1;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
