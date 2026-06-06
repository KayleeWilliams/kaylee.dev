import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const accept = context.request.headers.get("accept") ?? "";

  if (context.url.pathname === "/" && accept.includes("text/markdown")) {
    return context.rewrite("/markdown");
  }

  return next();
});
