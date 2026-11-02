import { type CollectionEntry, getCollection } from "astro:content";
import { getInthPosts } from "./get-inth-posts";

export type BlogPost = CollectionEntry<"blog">;

/** One row in the blog list: a post on this site, or one written for Inth. */
export interface BlogListing {
  description: string;
  /** Site-relative for posts here, absolute for posts elsewhere. */
  href: string;
  markdownHref: string;
  publishedAt: Date;
  /** Set when the post lives on another site. */
  source?: "Inth";
  tags: string[];
  title: string;
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const posts = await getCollection("blog", ({ data }) => !data.draft);

  return posts.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime()
  );
}

export async function getBlogListing(): Promise<BlogListing[]> {
  const [posts, inthPosts] = await Promise.all([
    getBlogPosts(),
    getInthPosts(),
  ]);
  const listing: BlogListing[] = [
    ...posts.map((post) => ({
      description: post.data.description,
      href: `/blog/${post.id}`,
      markdownHref: `/blog/${post.id}.md`,
      publishedAt: post.data.publishedAt,
      tags: post.data.tags,
      title: post.data.title,
    })),
    // Inth serves a Markdown copy of every post at the same path plus `.md`.
    ...inthPosts.map((post) => ({
      description: post.description,
      href: post.url,
      markdownHref: `${post.url}.md`,
      publishedAt: new Date(post.publishedAt),
      source: "Inth" as const,
      tags: [],
      title: post.title,
    })),
  ];

  return listing.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
}
