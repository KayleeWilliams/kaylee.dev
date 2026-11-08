import { afterEach, describe, expect, mock, test } from "bun:test";
import { normalizeXProfileTitle, renderRichMarkdown } from "./rich-markdown";

describe("normalizeXProfileTitle", () => {
  test("removes an X suffix when the handle uses display casing", () => {
    expect(
      normalizeXProfileTitle(
        "Christopher Burns (@BurnedChris) on X",
        "burnedchris"
      )
    ).toBe("Christopher Burns");
  });

  test("removes an X suffix when the handle casing already matches", () => {
    expect(
      normalizeXProfileTitle(
        "Tanner Linsley (@tannerlinsley) on X",
        "tannerlinsley"
      )
    ).toBe("Tanner Linsley");
  });

  test("preserves titles belonging to a different handle", () => {
    expect(
      normalizeXProfileTitle(
        "Christopher Burns (@someoneelse) on X",
        "burnedchris"
      )
    ).toBe("Christopher Burns (@someoneelse) on X");
  });

  test("handles missing metadata", () => {
    expect(normalizeXProfileTitle(undefined, "burnedchris")).toBeUndefined();
  });
});

describe("website link cards", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("inline the page's og:image so readers never request the host", async () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "https://graph.example.test/og.png") {
        return Promise.resolve(
          new Response(png, { headers: { "content-type": "image/png" } })
        );
      }
      return Promise.resolve(
        new Response(
          '<meta property="og:title" content="Graph"><meta property="og:image" content="/og.png">'
        )
      );
    }) as unknown as typeof fetch;

    const html = await renderRichMarkdown(
      "[https://graph.example.test/me](https://graph.example.test/me)"
    );

    expect(html).toContain(
      `<img class="rich-link__image" src="data:image/png;base64,${Buffer.from(png).toString("base64")}"`
    );
  });
});

describe("tweet embeds", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("show the tweets a reply answers, oldest first, with photos", async () => {
    const tweets: Record<string, object> = {
      "103": {
        id_str: "103",
        in_reply_to_status_id_str: "102",
        text: "@b ok yeah",
        user: { name: "C", screen_name: "c" },
      },
      "102": {
        display_text_range: [3, 22],
        id_str: "102",
        in_reply_to_status_id_str: "101",
        text: "@a can you rename it?",
        user: { name: "B", screen_name: "b" },
      },
      "101": {
        display_text_range: [0, 13],
        id_str: "101",
        mediaDetails: [
          {
            media_url_https: "https://pbs.twimg.com/media/trap.png",
            original_info: { height: 821, width: 640 },
            type: "photo",
          },
        ],
        text: "come here now https://t.co/photo",
        user: { name: "A", screen_name: "a" },
      },
    };
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.hostname === "cdn.syndication.twimg.com") {
        return Promise.resolve(
          Response.json(tweets[url.searchParams.get("id") ?? ""])
        );
      }
      if (url.hostname === "publish.twitter.com") {
        return Promise.resolve(
          Response.json({
            author_name: "C",
            author_url: "https://x.com/c",
            html: "<blockquote><p>ok yeah</p></blockquote>",
          })
        );
      }
      if (
        url.toString() ===
        "https://pbs.twimg.com/media/trap?format=jpg&name=small"
      ) {
        return Promise.resolve(
          new Response(new Uint8Array([255, 216]), {
            headers: { "content-type": "image/jpeg" },
          })
        );
      }
      return Promise.resolve(new Response("", { status: 404 }));
    }) as unknown as typeof fetch;

    const html = await renderRichMarkdown(
      "[https://x.com/c/status/103](https://x.com/c/status/103)"
    );

    const order = ["come here now", "can you rename it?", "ok yeah"].map(
      (text) => html.indexOf(text)
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).not.toContain("@a can");
    expect(html).toContain(
      '<img class="rich-tweet__photo" src="data:image/jpeg;base64,/9g="'
    );
  });
});
