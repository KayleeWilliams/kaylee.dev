import { withMemoryCache } from "./cache";

// Monthly download totals barely move hour to hour; cache long so the Runtime
// Cache (survives deploys) serves them without refetching on render.
const CACHE_TTL = 24 * 60 * 60;

export async function fetchNpmDownloads(
  packageName: string
): Promise<number | undefined> {
  try {
    return await withMemoryCache(
      `npm-downloads:${packageName}`,
      CACHE_TTL,
      async () => {
        const response = await fetch(
          `https://api.npmjs.org/downloads/point/last-month/${packageName}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        return data.downloads;
      }
    );
  } catch {
    return;
  }
}
