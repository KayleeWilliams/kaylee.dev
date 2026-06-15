import { defineMiddleware } from "astro:middleware";
import {
  markdownResponse,
  pageKeyFromPath,
  renderPageMarkdown,
} from "@/lib/agent-markdown";

// Content negotiation: an agent requesting a mirrored HTML page with
// `Accept: text/markdown` gets that page's Markdown mirror instead.
export const onRequest = defineMiddleware(async (context, next) => {
  const accept = context.request.headers.get("accept") ?? "";
  if (accept.includes("text/markdown")) {
    const key = pageKeyFromPath(context.url.pathname);
    if (key) {
      return markdownResponse(await renderPageMarkdown(key), {
        canonicalPath: context.url.pathname,
      });
    }
  }
  return next();
});
