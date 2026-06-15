import { markdownResponse, renderPageMarkdown } from "@/lib/agent-markdown";

export async function GET(): Promise<Response> {
  return markdownResponse(await renderPageMarkdown("connect"), {
    canonicalPath: "/connect",
  });
}
