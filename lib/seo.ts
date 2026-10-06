import { personConfig } from "@/lib/site-config";

export type SeoKey = "home" | "about" | "projects" | "blog" | "connect";

/**
 * Single source of truth for per-page <title> (≤60 chars) and meta description
 * (≤160 chars). Consumed by the HTML pages (BaseLayout) and the Markdown
 * mirrors (agent-markdown) so they can never drift.
 */
export const pageSeo: Record<SeoKey, { title: string; description: string }> = {
  home: {
    title: "Kaylee Williams: founding engineer at Inth, c15t co-author",
    description: personConfig.description,
  },
  about: {
    title: "About Kaylee Williams",
    description:
      "Kaylee Williams is a founding engineer at Inth (YC P26) and c15t co-author. She builds an open-source compliance stack for consent, data rights, and agent docs.",
  },
  projects: {
    title: "Projects by Kaylee Williams",
    description:
      "Kaylee Williams builds c15t, Cookiebench, DSAR, and Leadtype at Inth: open-source tools for consent, data rights, performance, and agent-readable docs.",
  },
  blog: {
    title: "Blog | Kaylee Williams",
    description:
      "Notes from Kaylee Williams on open-source compliance, developer tooling, privacy, and the details that make software feel finished.",
  },
  connect: {
    title: "Connect with Kaylee Williams",
    description:
      "Find Kaylee Williams on GitHub, LinkedIn, X, and Bluesky, plus her work at Inth and c15t.",
  },
};

/**
 * Records lives outside SeoKey because it has its own Markdown renderer
 * (records.md.ts), not the shared per-page mirror keyed by PageKey.
 */
export const recordsSeo = {
  title: "Kaylee Williams' Record Collection",
  description:
    "See the records and CDs Kaylee Williams owns. The collection loads from Discogs and includes album art and song previews.",
};
