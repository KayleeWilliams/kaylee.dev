import { withMemoryCache } from "./cache";
import { INTH_POST_SNAPSHOTS } from "./data-snapshots";

const FEED_URL = "https://inth.com/blog/feed.xml";
const AUTHOR = "Kaylee Williams";
const CATEGORIES = new Set(["Engineering"]);

// /blog is prerendered, so this mostly runs at build. Keep the TTL short so a
// deploy soon after a new Inth post doesn't get a stale feed from the Runtime
// Cache.
const CACHE_TTL = 60 * 60;

/** A post Kaylee wrote on the Inth blog. `publishedAt` is ISO so it survives the Runtime Cache. */
export interface InthPost {
  description: string;
  publishedAt: string;
  title: string;
  url: string;
}

const ITEM = /<item>([\s\S]*?)<\/item>/g;
const FIELDS = {
  author: /<dc:creator>([\s\S]*?)<\/dc:creator>/,
  category: /<category>([\s\S]*?)<\/category>/,
  description: /<description>([\s\S]*?)<\/description>/,
  link: /<link>([\s\S]*?)<\/link>/,
  pubDate: /<pubDate>([\s\S]*?)<\/pubDate>/,
  title: /<title>([\s\S]*?)<\/title>/,
};
const CDATA = /^<!\[CDATA\[([\s\S]*)\]\]>$/;
const ENTITY = /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi;
const NAMED: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

function decodeXml(raw: string): string {
  const text = raw.trim();
  const cdata = text.match(CDATA);
  if (cdata) {
    return cdata[1];
  }
  return text.replace(ENTITY, (_, entity: string) => {
    if (entity[0] !== "#") {
      return NAMED[entity.toLowerCase()];
    }
    const hex = entity[1] === "x" || entity[1] === "X";
    return String.fromCodePoint(
      Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
    );
  });
}

/** Kaylee's posts in the chosen categories from the Inth RSS feed, newest first. */
export function parseInthFeed(xml: string): InthPost[] {
  const posts: InthPost[] = [];
  for (const [, item] of xml.matchAll(ITEM)) {
    const field = (name: keyof typeof FIELDS) =>
      decodeXml(item.match(FIELDS[name])?.[1] ?? "");
    const publishedAt = new Date(field("pubDate"));
    const url = field("link");
    if (
      field("author") !== AUTHOR ||
      !CATEGORIES.has(field("category")) ||
      !url.startsWith("https://inth.com/") ||
      Number.isNaN(publishedAt.getTime())
    ) {
      continue;
    }
    posts.push({
      description: field("description"),
      publishedAt: publishedAt.toISOString(),
      title: field("title"),
      url,
    });
  }
  return posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

async function fetchInthPosts(): Promise<InthPost[]> {
  const response = await fetch(FEED_URL, {
    headers: { Accept: "application/rss+xml" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    return [];
  }
  return parseInthFeed(await response.text());
}

export function getInthPosts(): Promise<InthPost[]> {
  return withMemoryCache("inth-posts", CACHE_TTL, fetchInthPosts, {
    fallback: INTH_POST_SNAPSHOTS,
  });
}
