import { renderPortfolioMarkdown } from "@/lib/render-portfolio-markdown";

// /llms.txt — the agent-readability "Foundation surface": a plain-text,
// structured summary of who Kaylee is and what she works on, generated from the
// same source as the human-facing pages so it never drifts.
export async function GET(): Promise<Response> {
  const markdown = await renderPortfolioMarkdown();

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
