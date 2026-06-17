import type { APIContext } from "astro";
import { markdownResponse, renderPageMarkdown } from "@/lib/agent-markdown";

export async function GET({ url }: APIContext): Promise<Response> {
  return markdownResponse(await renderPageMarkdown("home", url.origin), {
    base: url.origin,
    canonicalPath: "/",
  });
}
