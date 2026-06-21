import { renderLlmsFull } from "@/lib/agent-markdown";

export const prerender = true;

// /llms-full.txt — the entire profile inlined as plain text.
export async function GET(): Promise<Response> {
  return new Response(await renderLlmsFull(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
