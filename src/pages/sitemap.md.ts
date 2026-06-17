import type { APIContext } from "astro";
import { markdownResponse, renderSitemapMarkdown } from "@/lib/agent-markdown";

export function GET({ url }: APIContext): Response {
  return markdownResponse(renderSitemapMarkdown(url.origin));
}
