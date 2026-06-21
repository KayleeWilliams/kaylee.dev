import { withMemoryCache } from "./cache";
import { NPM_DOWNLOAD_SNAPSHOTS } from "./data-snapshots";

// Monthly download totals barely move hour to hour; cache long so the Runtime
// Cache (survives deploys) serves them without refetching on render.
const CACHE_TTL = 24 * 60 * 60;

export async function fetchNpmDownloads(
  packageName: string
): Promise<number | undefined> {
  try {
    const packageKey = packageName.toLowerCase();
    const fallback = NPM_DOWNLOAD_SNAPSHOTS[packageKey];

    return await withMemoryCache(
      `npm-downloads:${packageKey}`,
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
      },
      fallback ? { fallback } : undefined
    );
  } catch {
    return;
  }
}
