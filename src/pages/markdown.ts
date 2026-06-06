import { renderPortfolioMarkdown } from "@/lib/render-portfolio-markdown";

export async function GET(): Promise<Response> {
  const markdown = await renderPortfolioMarkdown();

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      Vary: "Accept",
    },
  });
}
