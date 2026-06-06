import { getCollection } from "astro:content";
import dayjs from "dayjs";
import type { Experience, ExperienceFrontmatter } from "@/types/experience";

const MARKDOWN_EXTENSION_REGEX = /\.md$/;

function slugFromId(id: string) {
  return id.replace(MARKDOWN_EXTENSION_REGEX, "");
}

export async function getAllExperience(): Promise<Experience[]> {
  const entries = await getCollection("experience");
  const experiences = entries.map((entry) => ({
    slug: slugFromId(entry.id),
    content: entry.body ?? "",
    ...(entry.data as ExperienceFrontmatter),
  }));

  return experiences.sort((a, b) =>
    dayjs(b.startDate).diff(dayjs(a.startDate))
  );
}
