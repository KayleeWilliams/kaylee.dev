import recordNames from "../content/site/record-names.json";
import { withMemoryCache } from "./cache";
import { discogsHeaders } from "./discogs-auth";

// Discogs collections change rarely; 6h keeps the crate feeling live without
// hammering the API. The two-tier cache survives deploys, so cold starts are
// the only time we hit the origin.
const CACHE_TTL = 6 * 60 * 60;
const PER_PAGE = 100; // Discogs hard max.
const MAX_PAGES = 8; // Safety bound (~800 releases) against runaway pagination.
const API_BASE = "https://api.discogs.com";

// Discogs appends " (2)", " (3)" … to disambiguate same-named artists/labels.
const DISAMBIGUATION_SUFFIX = /\s*\(\d+\)$/;

// Discogs stores CJK artist/album names in native script only. This file layers
// on romanized/English display names, keyed by Discogs release id (as a string).
const NAME_OVERRIDES = recordNames as Record<
  string,
  { artistRoman?: string; titleRoman?: string }
>;

type DiscKind = "vinyl" | "cd" | "none";

/** Client-safe shape rendered by the crate island. No raw Discogs URLs. */
export interface ClientRecord {
  artist: string;
  artistRoman?: string;
  catno: string | null;
  coverPath: string;
  disc: DiscKind;
  discogsUrl: string;
  format: string;
  formatDetail: string | null;
  genres: string[];
  hasCover: boolean;
  id: number;
  label: string | null;
  title: string;
  titleRoman?: string;
  year: number | null;
}

/** Server-side record; keeps the raw cover URL for the same-origin proxy. */
export interface CollectionRecord extends ClientRecord {
  coverImage: string | null;
}

export interface DiscogsCollection {
  cdCount: number;
  records: CollectionRecord[];
  total: number;
  vinylCount: number;
}

interface RawArtist {
  anv?: string;
  join?: string;
  name?: string;
}
interface RawLabel {
  catno?: string;
  name?: string;
}
interface RawFormat {
  descriptions?: string[];
  name?: string;
}
interface RawBasicInfo {
  artists?: RawArtist[];
  cover_image?: string;
  formats?: RawFormat[];
  genres?: string[];
  id?: number;
  labels?: RawLabel[];
  styles?: string[];
  thumb?: string;
  title?: string;
  year?: number;
}
interface RawRelease {
  basic_information?: RawBasicInfo;
  id?: number;
}
interface RawPagination {
  items?: number;
  pages?: number;
}
interface RawCollectionResponse {
  pagination?: RawPagination;
  releases?: RawRelease[];
}

// Strip the disambiguation suffix for display.
function cleanName(name: string): string {
  return name.replace(DISAMBIGUATION_SUFFIX, "").trim();
}

function formatArtists(artists: RawArtist[] | undefined): string {
  if (!artists?.length) {
    return "Unknown Artist";
  }
  let out = "";
  for (const [index, artist] of artists.entries()) {
    const name = cleanName(artist.anv?.trim() || artist.name?.trim() || "");
    if (!name) {
      continue;
    }
    out += name;
    const join = artist.join?.trim();
    const isLast = index === artists.length - 1;
    if (!isLast) {
      out += join === "," || !join ? ", " : ` ${join} `;
    }
  }
  return out || "Unknown Artist";
}

function resolveDisc(formatName: string): DiscKind {
  if (formatName === "Vinyl") {
    return "vinyl";
  }
  if (formatName === "CD" || formatName === "CDr") {
    return "cd";
  }
  return "none";
}

// Discogs serves a generic spacer when a release has no art; treat that (and a
// missing URL) as "no cover" so the island can render a typeset sleeve instead.
function hasRealCover(url: string | undefined): url is string {
  return Boolean(url) && !(url as string).includes("spacer.gif");
}

function normalizeRelease(release: RawRelease): CollectionRecord | null {
  const info = release.basic_information;
  const id = info?.id ?? release.id;
  if (!(info && id)) {
    return null;
  }

  const format = info.formats?.[0];
  const formatName = format?.name?.trim() || "Release";
  const descriptions = (format?.descriptions ?? [])
    .map((d) => d.trim())
    .filter(Boolean);
  const label = info.labels?.[0];
  const labelName = label?.name ? cleanName(label.name) : null;
  const catno =
    label?.catno && label.catno.toLowerCase() !== "none"
      ? label.catno.trim()
      : null;
  const genres = [...(info.genres ?? []), ...(info.styles ?? [])]
    .map((g) => g.trim())
    .filter(Boolean);
  const cover = hasRealCover(info.cover_image) ? info.cover_image : null;

  const record: CollectionRecord = {
    id,
    title: info.title?.trim() || "Untitled",
    artist: formatArtists(info.artists),
    year: info.year && info.year > 0 ? info.year : null,
    label: labelName,
    catno,
    format: formatName,
    formatDetail: descriptions.length ? descriptions.join(", ") : null,
    disc: resolveDisc(formatName),
    genres: [...new Set(genres)].slice(0, 3),
    hasCover: Boolean(cover),
    coverPath: `/records/cover/${id}`,
    coverImage: cover,
    discogsUrl: `https://www.discogs.com/release/${id}`,
  };

  const override = NAME_OVERRIDES[String(id)];
  if (override?.artistRoman) {
    record.artistRoman = override.artistRoman;
  }
  if (override?.titleRoman) {
    record.titleRoman = override.titleRoman;
  }

  return record;
}

async function fetchPage(
  username: string,
  page: number
): Promise<RawCollectionResponse | null> {
  // Filed alphabetically by artist, like a record shop. Discogs' artist sort
  // uses sort-names, so "The Beatles" lands under B, not T.
  const url =
    `${API_BASE}/users/${encodeURIComponent(username)}/collection/folders/0/releases` +
    `?per_page=${PER_PAGE}&page=${page}&sort=artist&sort_order=asc`;
  const response = await fetch(url, { headers: discogsHeaders() });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as RawCollectionResponse;
}

async function loadCollection(
  username: string
): Promise<DiscogsCollection | null> {
  try {
    const first = await fetchPage(username, 1);
    if (!first?.releases) {
      return null;
    }

    const releases = [...first.releases];
    const totalPages = Math.min(first.pagination?.pages ?? 1, MAX_PAGES);

    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          fetchPage(username, index + 2)
        )
      );
      for (const pageData of rest) {
        if (pageData?.releases) {
          releases.push(...pageData.releases);
        }
      }
    }

    const records = releases
      .map(normalizeRelease)
      .filter((record): record is CollectionRecord => record !== null);

    if (records.length === 0) {
      return null;
    }

    return {
      records,
      total: first.pagination?.items ?? records.length,
      vinylCount: records.filter((r) => r.disc === "vinyl").length,
      cdCount: records.filter((r) => r.disc === "cd").length,
    };
  } catch {
    return null;
  }
}

export function getDiscogsCollection(
  username: string
): Promise<DiscogsCollection | null> {
  return withMemoryCache(`discogs-collection:${username}`, CACHE_TTL, () =>
    loadCollection(username)
  );
}

/** Strip the raw cover URL before handing records to the client island. */
export function toClientRecords(records: CollectionRecord[]): ClientRecord[] {
  return records.map(({ coverImage: _coverImage, ...rest }) => rest);
}

/** Resolve a single release's raw cover URL for the same-origin image proxy. */
export async function getCoverImageUrl(
  username: string,
  releaseId: number
): Promise<string | null> {
  const collection = await getDiscogsCollection(username);
  const record = collection?.records.find((r) => r.id === releaseId);
  return record?.coverImage ?? null;
}
