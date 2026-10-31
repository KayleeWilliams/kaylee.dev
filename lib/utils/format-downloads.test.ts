import { describe, expect, test } from "bun:test";
import { formatDownloads } from "./format-downloads";

describe("formatDownloads", () => {
  test("rounds down so a trailing + stays true", () => {
    expect(formatDownloads(1_268_505)).toBe("1.2M");
    expect(formatDownloads(195_566)).toBe("195.5k");
  });

  test("keeps exact values", () => {
    expect(formatDownloads(1_300_000)).toBe("1.3M");
    expect(formatDownloads(999)).toBe("999");
  });
});
