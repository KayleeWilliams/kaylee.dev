import type { APIContext } from "astro";
import { markdownResponse } from "@/lib/agent-markdown";
import {
  type ClientRecord,
  getDiscogsCollection,
} from "@/lib/get-discogs-collection";
import { personConfig } from "@/lib/site-config";

// Dynamic, like the page itself, so the listing reflects the live collection.
// markdownResponse adds the 1h SWR cache headers.
export const prerender = false;

const TRAILING_SLASHES = /\/+$/;

/** "2024 · LP, Album · Electronic, House" — the bits an agent cares about. */
function recordMeta(record: ClientRecord): string {
  return [
    record.year ? String(record.year) : null,
    record.formatDetail ?? record.format,
    record.genres.length > 0 ? record.genres.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function recordLine(record: ClientRecord): string {
  const artist = record.artistRoman ?? record.artist;
  const title = record.titleRoman ?? record.title;
  // Surface the native script too when we display a romanized name.
  const native =
    record.artistRoman || record.titleRoman
      ? ` (${record.artist} — ${record.title})`
      : "";
  return `- **${artist} — ${title}**${native} — ${recordMeta(record)} — ${record.discogsUrl}`;
}

export async function GET({ url }: APIContext): Promise<Response> {
  const collection = await getDiscogsCollection(personConfig.discogsUsername);
  const records = collection?.records ?? [];
  const total = collection?.total ?? records.length;
  const vinyl = collection?.vinylCount ?? 0;
  const cds = collection?.cdCount ?? 0;

  const base = url.origin.replace(TRAILING_SLASHES, "");
  const collectionUrl = `https://www.discogs.com/user/${personConfig.discogsUsername}/collection`;
  const description = `The records and CDs ${personConfig.name} owns, from her Discogs collection.`;

  const lines: string[] = [
    "---",
    `title: "The Crate — ${personConfig.name}"`,
    `description: "${description}"`,
    `canonical_url: "${base}/records.md"`,
    `last_updated: "${new Date().toISOString()}"`,
    "---",
    "",
    "# The Crate",
    "",
    `${personConfig.name}'s personal collection of records and CDs she actually owns, filed alphabetically by artist and pulled live from [Discogs](${collectionUrl}). A hidden page on ${personConfig.siteUrl}/records that renders the collection as an interactive coverflow.`,
    "",
  ];

  if (records.length === 0) {
    lines.push(
      "The collection is temporarily unavailable. Browse it directly on " +
        `[Discogs](${collectionUrl}).`,
      ""
    );
  } else {
    const cdLabel = cds === 1 ? "CD" : "CDs";
    lines.push(
      `## Collection — ${total} releases (${vinyl} vinyl, ${cds} ${cdLabel})`,
      "",
      ...records.map(recordLine),
      ""
    );
  }

  lines.push(
    "## More",
    "",
    `- Full collection on Discogs: ${collectionUrl}`,
    `- [Home](${base}/) — [markdown](${base}/index.md)`,
    `- [Sitemap](${base}/sitemap.md)`
  );

  return markdownResponse(`${lines.join("\n").trimEnd()}\n`, {
    base: url.origin,
    canonicalPath: "/records.md",
  });
}
