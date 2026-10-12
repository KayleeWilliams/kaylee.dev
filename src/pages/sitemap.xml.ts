import type { APIContext } from "astro";
import { getBlogPosts } from "@/lib/get-blog-posts";

export const prerender = true;

const TRAILING_SLASHES_REGEX = /\/+$/;

export async function GET({ url }: APIContext): Promise<Response> {
  const base = url.origin.replace(TRAILING_SLASHES_REGEX, "");
  const now = new Date().toISOString();
  const posts = await getBlogPosts();
  const routes = [
    { path: "/", priority: "1" },
    { path: "/about", priority: "0.8" },
    { path: "/projects", priority: "0.8" },
    { path: "/blog", priority: "0.7" },
    ...posts.map((post) => ({ path: `/blog/${post.id}`, priority: "0.6" })),
    { path: "/connect", priority: "0.5" },
    { path: "/records", priority: "0.4" },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map(
      ({ path, priority }) =>
        `  <url><loc>${base}${path}</loc><lastmod>${now}</lastmod><priority>${priority}</priority></url>`
    )
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
