import { personConfig } from "@/lib/site-config";

export type SeoKey = "home" | "about" | "projects" | "connect";

/**
 * Single source of truth for per-page <title> (≤60 chars) and meta description
 * (≤160 chars). Consumed by the HTML pages (BaseLayout) and the Markdown
 * mirrors (agent-markdown) so they can never drift.
 */
export const pageSeo: Record<SeoKey, { title: string; description: string }> = {
  home: {
    title: "Kaylee Williams — Founding Engineer at Inth, c15t co-author",
    description: personConfig.description,
  },
  about: {
    title: "About — Kaylee Williams",
    description:
      "Kaylee Williams — founding engineer at Inth (YC P26), co-author of c15t. Open-source consent, data rights, and agent-readable docs for developers.",
  },
  projects: {
    title: "Projects — Kaylee Williams",
    description:
      "Open-source tools for consent, privacy, and developer experience by Kaylee Williams at Inth: c15t, Cookiebench, DSAR, and LeadType.",
  },
  connect: {
    title: "Connect — Kaylee Williams",
    description:
      "Connect with Kaylee Williams — GitHub, LinkedIn, X, and Bluesky.",
  },
};
