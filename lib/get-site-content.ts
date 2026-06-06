import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface SiteContentFrontmatter {
  title?: string;
}

export interface SiteContent extends SiteContentFrontmatter {
  content: string;
  slug: string;
}

const siteContentDirectory = path.join(process.cwd(), "content/site");

export function getSiteContent<T = SiteContentFrontmatter>(
  slug: string
): ({ slug: string; content: string } & T) | null {
  const fullPath = path.join(siteContentDirectory, `${slug}.md`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    slug,
    content,
    ...(data as T),
  };
}
