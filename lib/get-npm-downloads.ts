import { withMemoryCache } from "./cache";
import { NPM_DOWNLOAD_SNAPSHOTS } from "./data-snapshots";

// Monthly download totals barely move hour to hour; cache long so the Runtime
// Cache (survives deploys) serves them without refetching on render.
const CACHE_TTL = 24 * 60 * 60;

interface DedupedTotal {
  add: string[];
  subtractLargestOf: string[];
}

// In v3, `c15t` is an umbrella that installs @c15t/core and every framework
// adapter, while @c15t/react and @c15t/nextjs install @c15t/core directly. So
// c15t + @c15t/core counts each v3 umbrella install twice. npm has no monthly
// per-version counts, so the adapters only the umbrella pulls in stand in for
// c15t 3.x; subtracting the largest keeps the total a floor.
const DEDUPED_TOTALS: Record<string, DedupedTotal> = {
  c15t: {
    add: ["@c15t/core"],
    subtractLargestOf: [
      "@c15t/astro",
      "@c15t/svelte",
      "@c15t/tanstack-start",
      "@c15t/vue",
    ],
  },
};

async function fetchLastMonth(
  packageName: string
): Promise<number | undefined> {
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
  return typeof data.downloads === "number" ? data.downloads : undefined;
}

async function fetchDedupedTotal(
  packageName: string,
  { add, subtractLargestOf }: DedupedTotal
): Promise<number | undefined> {
  const counts = await Promise.all(
    [packageName, ...add, ...subtractLargestOf].map(fetchLastMonth)
  );

  // A partial total would be wrong in either direction; let the snapshot cover it.
  if (counts.some((count) => count === undefined)) {
    return;
  }

  const [main, ...rest] = counts as number[];
  const added = rest.slice(0, add.length);
  const subtracted = rest.slice(add.length);
  return (
    main +
    added.reduce((sum, count) => sum + count, 0) -
    Math.max(...subtracted)
  );
}

export async function fetchNpmDownloads(
  packageName: string
): Promise<number | undefined> {
  try {
    const packageKey = packageName.toLowerCase();
    const fallback = NPM_DOWNLOAD_SNAPSHOTS[packageKey];
    const deduped = DEDUPED_TOTALS[packageKey];

    return await withMemoryCache(
      // A distinct key so the Runtime Cache can't serve a single-package count
      // cached before deduping existed.
      deduped
        ? `npm-downloads-deduped:${packageKey}`
        : `npm-downloads:${packageKey}`,
      CACHE_TTL,
      () =>
        deduped
          ? fetchDedupedTotal(packageName, deduped)
          : fetchLastMonth(packageName),
      fallback ? { fallback } : undefined
    );
  } catch {
    return;
  }
}
