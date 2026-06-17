import { defineMiddleware } from "astro:middleware";
import {
  markdownResponse,
  pageKeyFromPath,
  renderNotFoundMarkdown,
  renderPageMarkdown,
} from "@/lib/agent-markdown";

// AI/answer-engine crawlers that should receive Markdown instead of HTML.
const AI_AGENT_UA =
  /GPTBot|OAI-SearchBot|ChatGPT|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|CCBot|Bytespider|cohere-ai/i;

function isPageLike(pathname: string): boolean {
  const last = pathname.split("/").pop() ?? "";
  return !last.includes(".");
}

// Content negotiation: serve a page's Markdown mirror when an agent asks for it
// via `Accept: text/markdown` or an AI User-Agent. Unknown pages get a 200
// Markdown soft-404 (agents discard 404 bodies).
export const onRequest = defineMiddleware(async (context, next) => {
  const accept = context.request.headers.get("accept") ?? "";
  const userAgent = context.request.headers.get("user-agent") ?? "";
  const wantsMarkdown =
    accept.includes("text/markdown") || AI_AGENT_UA.test(userAgent);

  if (wantsMarkdown) {
    const base = context.url.origin;
    const key = pageKeyFromPath(context.url.pathname);
    if (key) {
      return markdownResponse(await renderPageMarkdown(key, base), {
        base,
        canonicalPath: context.url.pathname,
      });
    }
    if (isPageLike(context.url.pathname)) {
      const response = await next();
      if (response.status === 404) {
        return markdownResponse(renderNotFoundMarkdown(base));
      }
      return response;
    }
  }

  return next();
});
