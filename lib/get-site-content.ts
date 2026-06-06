import { getCollection } from "astro:content";

export interface SiteContentFrontmatter {
  title?: string;
}

export interface SiteContent extends SiteContentFrontmatter {
  content: string;
  slug: string;
}

export async function getSiteContent<T = SiteContentFrontmatter>(
  slug: string
): Promise<({ slug: string; content: string } & T) | null> {
  const entries = await getCollection("site");
  const entry = entries.find((item) => item.id === slug);

  return entry
    ? {
        slug,
        content: entry.body ?? "",
        ...(entry.data as T),
      }
    : null;
}
