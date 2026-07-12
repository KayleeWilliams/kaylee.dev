import { describe, expect, test } from "bun:test";
import { normalizeXProfileTitle } from "./rich-markdown";

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
