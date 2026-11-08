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
