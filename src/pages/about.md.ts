import { markdownResponse, renderPageMarkdown } from "@/lib/agent-markdown";

export async function GET(): Promise<Response> {
  return markdownResponse(await renderPageMarkdown("about"), {
    canonicalPath: "/about",
  });
}
