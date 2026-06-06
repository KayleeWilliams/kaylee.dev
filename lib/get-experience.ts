import { getCollection } from "astro:content";
import type { Experience, ExperienceFrontmatter } from "@/types/experience";

const MARKDOWN_EXTENSION_REGEX = /\.md$/;

function slugFromId(id: string) {
  return id.replace(MARKDOWN_EXTENSION_REGEX, "");
}

export async function getExperience(slug: string): Promise<Experience | null> {
  const entries = await getCollection("experience");
  const entry = entries.find((item) => slugFromId(item.id) === slug);

  if (!entry) {
    return null;
  }

  return {
    slug,
    content: entry.body ?? "",
    ...(entry.data as ExperienceFrontmatter),
  };
}
