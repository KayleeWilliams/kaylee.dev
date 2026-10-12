import { markdownResponse } from "@/lib/agent-markdown";
import { getBlogPosts } from "@/lib/get-blog-posts";
import { pageSeo } from "@/lib/seo";

export const prerender = true;

export async function GET({ url }: { url: URL }): Promise<Response> {
  const posts = await getBlogPosts();
  const body = [
    "---",
    `title: "${pageSeo.blog.title}"`,
    `description: "${pageSeo.blog.description}"`,
    `canonical_url: "${url.origin}/blog"`,
    "---",
    "",
    "# Blog",
    "",
    ...posts.flatMap((post) => [
      `## [${post.data.title}](${url.origin}/blog/${post.id}.md)`,
      "",
      post.data.description,
      "",
      `Published: ${post.data.publishedAt.toISOString().slice(0, 10)}`,
      "",
    ]),
  ].join("\n");

  return markdownResponse(`${body.trimEnd()}\n`, {
    base: url.origin,
    canonicalPath: "/blog",
  });
}
