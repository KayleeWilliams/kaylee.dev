import { markdownResponse } from "@/lib/agent-markdown";
import { getBlogListing } from "@/lib/get-blog-posts";
import { pageSeo } from "@/lib/seo";

export const prerender = true;

export async function GET({ url }: { url: URL }): Promise<Response> {
  const posts = await getBlogListing();
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
      `## [${post.title}](${new URL(post.markdownHref, url.origin).href})`,
      "",
      post.description,
      "",
      `Published: ${post.publishedAt.toISOString().slice(0, 10)}${post.source ? ` on the ${post.source} blog` : ""}`,
      "",
    ]),
  ].join("\n");

  return markdownResponse(`${body.trimEnd()}\n`, {
    base: url.origin,
    canonicalPath: "/blog",
  });
}
