import { describe, expect, test } from "bun:test";
import { parseInthFeed } from "./get-inth-posts";

const item = (fields: Record<string, string>) =>
  `<item>${Object.entries(fields)
    .map(([tag, value]) => `<${tag}>${value}</${tag}>`)
    .join("")}</item>`;

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Inth blog</title>
<link>https://inth.com/blog</link>
${item({
  title: "Your third-party scripts aren&apos;t pinned",
  link: "https://inth.com/blog/third-party-scripts-arent-pinned",
  pubDate: "Tue, 27 Oct 2026 17:05:55 GMT",
  description: "Someone else's post.",
  category: "Engineering",
  "dc:creator": "Christopher Burns",
})}
${item({
  title: "How small and fast can a TypeScript CLI get?",
  link: "https://inth.com/blog/how-small-and-fast-can-a-typescript-cli-get",
  pubDate: "Thu, 24 Sep 2026 15:15:59 GMT",
  description: "<![CDATA[Zig, Rust & Go]]>",
  category: "Engineering",
  "dc:creator": "Kaylee Williams",
})}
${item({
  title: "We built a cookie banner that makes your scripts start sooner",
  link: "https://inth.com/blog/cookie-banner-scripts-start-sooner",
  pubDate: "Thu, 29 Oct 2026 16:49:02 GMT",
  description: "A returning visitor&apos;s consent &amp; more",
  category: "Engineering",
  "dc:creator": "Kaylee Williams",
})}
${item({
  title: "Introducing the Inth CLI",
  link: "https://inth.com/blog/introducing-inth-cli",
  pubDate: "Thu, 24 Sep 2026 10:00:00 GMT",
  description: "A company post.",
  category: "Company",
  "dc:creator": "Kaylee Williams",
})}
</channel></rss>`;

describe("parseInthFeed", () => {
  test("keeps only Kaylee's Engineering posts, newest first, with text decoded", () => {
    expect(parseInthFeed(feed)).toEqual([
      {
        title: "We built a cookie banner that makes your scripts start sooner",
        description: "A returning visitor's consent & more",
        url: "https://inth.com/blog/cookie-banner-scripts-start-sooner",
        publishedAt: "2026-10-29T16:49:02.000Z",
      },
      {
        title: "How small and fast can a TypeScript CLI get?",
        description: "Zig, Rust & Go",
        url: "https://inth.com/blog/how-small-and-fast-can-a-typescript-cli-get",
        publishedAt: "2026-09-24T15:15:59.000Z",
      },
    ]);
  });

  test("returns nothing for a page that isn't a feed", () => {
    expect(parseInthFeed("<html><body>Not found</body></html>")).toEqual([]);
  });
});
