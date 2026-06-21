import type { APIContext } from "astro";
import { markdownResponse, renderPageMarkdown } from "@/lib/agent-markdown";

export const prerender = true;

export async function GET({ url }: APIContext): Promise<Response> {
  return markdownResponse(await renderPageMarkdown("projects", url.origin), {
    base: url.origin,
    canonicalPath: "/projects",
  });
}
