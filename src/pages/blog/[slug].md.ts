import { markdownResponse } from "@/lib/agent-markdown";
import { type BlogPost, getBlogPosts } from "@/lib/get-blog-posts";
import { renderAgentMarkdown } from "@/lib/rich-markdown";

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getBlogPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export async function GET({
  props,
  url,
}: {
  props: { post: BlogPost };
  url: URL;
}): Promise<Response> {
  const { post } = props;
  const content = await renderAgentMarkdown(post.body ?? "");
  const body = [
    "---",
    `title: ${JSON.stringify(post.data.title)}`,
    `description: ${JSON.stringify(post.data.description)}`,
    `canonical_url: "${url.origin}/blog/${post.id}"`,
    `published: "${post.data.publishedAt.toISOString()}"`,
    ...(post.data.updatedAt
      ? [`updated: "${post.data.updatedAt.toISOString()}"`]
      : []),
    "---",
    "",
    `# ${post.data.title}`,
    "",
    content,
    "",
  ].join("\n");

  return markdownResponse(body, {
    base: url.origin,
    canonicalPath: `/blog/${post.id}`,
  });
}
