import { describe, expect, test } from "bun:test";
import { withMemoryCache } from "./cache";

describe("withMemoryCache with a fallback", () => {
  test("waits for the live value on a cold cache instead of returning the fallback", async () => {
    const value = await withMemoryCache("test:cold-live", 60, async () => 5, {
      fallback: 1,
    });
    expect(value).toBe(5);
  });

  test("uses the fallback when the load comes back empty", async () => {
    const value = await withMemoryCache(
      "test:cold-empty",
      60,
      async () => undefined as number | undefined,
      { fallback: 1 }
    );
    expect(value).toBe(1);
  });

  test("uses the fallback when the load throws", async () => {
    const value = await withMemoryCache(
      "test:cold-throws",
      60,
      () => Promise.reject(new Error("offline")),
      { fallback: 1 }
    );
    expect(value).toBe(1);
  });

  test("keeps using the fallback after a failed load is cached", async () => {
    const failing = async () => undefined as number | undefined;
    await withMemoryCache("test:cached-empty", 60, failing, { fallback: 1 });
    const second = await withMemoryCache("test:cached-empty", 60, failing, {
      fallback: 1,
    });
    expect(second).toBe(1);
  });
});
