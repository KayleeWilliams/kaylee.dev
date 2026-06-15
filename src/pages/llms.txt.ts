import { renderLlmsIndex } from "@/lib/agent-markdown";

// /llms.txt — concise index (llmstxt.org format) linking the Markdown mirrors.
export function GET(): Response {
  return new Response(renderLlmsIndex(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
