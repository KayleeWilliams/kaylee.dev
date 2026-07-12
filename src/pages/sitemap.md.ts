import type { APIContext } from "astro";
import { markdownResponse, renderSitemapMarkdown } from "@/lib/agent-markdown";

export const prerender = true;

export async function GET({ url }: APIContext): Promise<Response> {
  return markdownResponse(await renderSitemapMarkdown(url.origin));
}
