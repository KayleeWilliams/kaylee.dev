import { personConfig } from "@/lib/site-config";

export type SeoKey = "home" | "about" | "projects" | "connect";

/**
 * Single source of truth for per-page <title> (≤60 chars) and meta description
 * (≤160 chars). Consumed by the HTML pages (BaseLayout) and the Markdown
 * mirrors (agent-markdown) so they can never drift.
 */
export const pageSeo: Record<SeoKey, { title: string; description: string }> = {
  home: {
    title: "Kaylee Williams: Founding Engineer at Inth, c15t co-author",
    description: personConfig.description,
  },
  about: {
    title: "About Kaylee Williams",
    description:
      "Kaylee Williams is a founding engineer at Inth (YC P26) and co-author of c15t. She builds open-source tools for consent, data rights, and agent-readable docs.",
  },
  projects: {
    title: "Projects by Kaylee Williams",
    description:
      "Open-source tools for consent, privacy, and developer experience by Kaylee Williams at Inth: c15t, Cookiebench, DSAR, and Leadtype.",
  },
  connect: {
    title: "Connect with Kaylee Williams",
    description:
      "Connect with Kaylee Williams on GitHub, LinkedIn, X, and Bluesky, or follow the work at Inth and c15t.",
  },
};

/**
 * Records lives outside SeoKey because it has its own Markdown renderer
 * (records.md.ts), not the shared per-page mirror keyed by PageKey.
 */
export const recordsSeo = {
  title: "Kaylee Williams' Record Collection",
  description:
    "Browse the records and CDs Kaylee Williams owns, pulled live from Discogs with album artwork and song previews.",
};
