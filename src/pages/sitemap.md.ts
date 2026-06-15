import { markdownResponse, renderSitemapMarkdown } from "@/lib/agent-markdown";

export function GET(): Response {
  return markdownResponse(renderSitemapMarkdown());
}
