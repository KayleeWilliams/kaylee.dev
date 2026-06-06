import { withMemoryCache } from "./cache";

const ONE_HOUR = 60 * 60;

export async function fetchNpmDownloads(
  packageName: string
): Promise<number | undefined> {
  try {
    return await withMemoryCache(
      `npm-downloads:${packageName}`,
      ONE_HOUR,
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
