import recordMusic from "../content/site/record-music.json";
import { withMemoryCache } from "./cache";
import type { ClientRecord, TrackPreview } from "./get-discogs-collection";

// The pick is stable per release and costs an Apple search + lookup, so cache
// it hard. Apple's terms forbid caching the audio bytes, not this metadata;
// failed/empty results get the cache's short empty TTL and self-heal.
const PREVIEW_TTL = 30 * 24 * 60 * 60;

const ITUNES_BASE = "https://itunes.apple.com";

// Apple lists many Japanese releases in the US store without playable tracks;
// the JP storefront has them. Track/collection ids are global across stores.
const STOREFRONTS = ["US", "JP"] as const;

const USER_AGENT = "KayleeDevPortfolio/1.0 (+https://www.kaylee.dev)";

// SSR-side parallelism bound for a cold cache.
const RESOLVE_CONCURRENCY = 6;

// Per-release curation: `appleTrackId` pins an exact song (the `?i=` number in
// an Apple Music track URL); `appleAlbumId` disambiguates the album search.
// Without either, a stable-random album track is used.
const MUSIC_OVERRIDES = recordMusic as Record<
  string,
  { appleAlbumId?: number; appleTrackId?: number }
>;

interface AppleTrack {
  artistName?: string;
  previewUrl: string;
  trackId: number;
  trackName: string;
  trackNumber: number;
  trackViewUrl: string;
}
interface AppleAlbum {
  collectionViewUrl: string;
  tracks: AppleTrack[];
}

interface ItunesResult {
  artistName?: string;
  collectionId?: number;
  collectionViewUrl?: string;
  previewUrl?: string;
  trackId?: number;
  trackName?: string;
  trackNumber?: number;
  trackViewUrl?: string;
  wrapperType?: string;
}
interface ItunesResponse {
  results?: ItunesResult[];
}

const jsonHeaders = { "User-Agent": USER_AGENT, Accept: "application/json" };

// "Various (Artists)" is no real artist to search on.
const VARIOUS = /^various\b/i;
function dropVarious(artist: string): string {
  return VARIOUS.test(artist) ? "" : artist;
}

// "Laura Shigihara, Peter McConnell" → "Laura Shigihara".
const ARTIST_SEP = /,| & | feat/i;
function leadArtist(artist: string): string {
  return dropVarious(artist).split(ARTIST_SEP)[0].trim();
}

// Stray quote runs Discogs sometimes embeds ("''Good Guy''").
const STRAY_QUOTES = /["“”]|''+/g;
function cleanTitle(title: string): string {
  return title.replace(STRAY_QUOTES, "").trim();
}

// Ordered search candidates, most specific first. Apple indexes J-pop under
// romaji, so the romanized names drive the query when present.
function searchTerms(record: ClientRecord): string[] {
  const artist = record.artistRoman ?? record.artist;
  const title = cleanTitle(record.titleRoman ?? record.title);
  const head = title.split(" / ")[0].trim();
  const lead = leadArtist(artist);
  const candidates = [
    `${dropVarious(artist)} ${title}`,
    `${lead} ${title}`,
    `${lead} ${head}`,
    title,
    head,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    const term = candidate.trim();
    if (term && !seen.has(term)) {
      seen.add(term);
      out.push(encodeURIComponent(term));
    }
  }
  return out;
}

// Deterministic pick so a record always shows the same track, while still
// spreading picks across the tracklist.
function stableIndex(seed: number, length: number): number {
  let hash = 0;
  for (const ch of String(seed)) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 1_000_000_007;
  }
  return hash % length;
}

// Apple throttles bursts (~20 searches/min per IP) with 403/429s. On any
// push-back — or a hung socket — trip a cooldown and fail fast so the page
// renders without the unresolved previews; they self-heal on later requests.
let throttledUntil = 0;
const THROTTLE_COOLDOWN_MS = 60 * 1000;

// A hung Apple socket must never hold the whole SSR response hostage.
const FETCH_TIMEOUT_MS = 5 * 1000;

async function itunesGet(path: string): Promise<ItunesResult[] | null> {
  if (Date.now() < throttledUntil) {
    return null;
  }
  try {
    const res = await fetch(`${ITUNES_BASE}/${path}`, {
      headers: jsonHeaders,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 403 || res.status === 429) {
      throttledUntil = Date.now() + THROTTLE_COOLDOWN_MS;
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return ((await res.json()) as ItunesResponse).results ?? [];
  } catch (error) {
    if ((error as Error).name === "TimeoutError") {
      throttledUntil = Date.now() + THROTTLE_COOLDOWN_MS;
    }
    return null;
  }
}

function toPreview(track: AppleTrack, albumUrl: string): TrackPreview {
  return {
    artistName: track.artistName,
    previewUrl: track.previewUrl,
    trackName: track.trackName,
    appleUrl: track.trackViewUrl || albumUrl,
  };
}

// Direct lookup by track id, US store first — it carries romanized titles for
// Japanese tracks.
async function fetchTrackById(trackId: number): Promise<TrackPreview | null> {
  for (const country of STOREFRONTS) {
    const r = (
      await itunesGet(
        `lookup?id=${trackId}&country=${country}&entity=song&limit=1`
      )
    )?.[0];
    if (r?.wrapperType === "track" && r.previewUrl && r.trackName) {
      const albumUrl = r.collectionViewUrl ?? r.trackViewUrl ?? "";
      return toPreview(
        {
          artistName: r.artistName,
          previewUrl: r.previewUrl,
          trackId,
          trackName: r.trackName,
          trackNumber: r.trackNumber ?? 1,
          trackViewUrl: r.trackViewUrl ?? albumUrl,
        },
        albumUrl
      );
    }
  }
  return null;
}

const NON_ALNUM = /[^a-z0-9぀-ヿ一-鿿]/g;
function normArtist(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(NON_ALNUM, "");
}

// Loose artist check so a fuzzy (title-only) search can't grab an unrelated
// same-named album; matches native or romaji spellings.
function artistMatches(record: ClientRecord, resultArtist?: string): boolean {
  if (!resultArtist) {
    return false;
  }
  const b = normArtist(resultArtist);
  for (const name of [record.artist, record.artistRoman]) {
    const a = name ? normArtist(leadArtist(name)) : "";
    if (a && b && (a.includes(b) || b.includes(a))) {
      return true;
    }
  }
  return false;
}

async function itunesSearchAlbumId(
  record: ClientRecord
): Promise<number | null> {
  // "Various" leaves nothing to verify against; trust the title match.
  const verify = leadArtist(record.artistRoman ?? record.artist) !== "";
  for (const term of searchTerms(record)) {
    for (const country of STOREFRONTS) {
      const hit = (
        await itunesGet(
          `search?term=${term}&country=${country}&entity=album&limit=1`
        )
      )?.[0];
      if (
        hit?.collectionId &&
        (!verify || artistMatches(record, hit.artistName))
      ) {
        return hit.collectionId;
      }
    }
  }
  return null;
}

async function fetchAppleAlbum(
  collectionId: number
): Promise<AppleAlbum | null> {
  for (const country of STOREFRONTS) {
    const results = await itunesGet(
      `lookup?id=${collectionId}&country=${country}&entity=song&limit=200`
    );
    if (!results) {
      continue;
    }
    const album = results.find((r) => r.wrapperType === "collection");
    const tracks: AppleTrack[] = [];
    for (const r of results) {
      if (r.wrapperType === "track" && r.previewUrl && r.trackName) {
        tracks.push({
          artistName: r.artistName,
          previewUrl: r.previewUrl,
          trackId: r.trackId ?? 0,
          trackName: r.trackName,
          trackNumber: r.trackNumber ?? tracks.length + 1,
          trackViewUrl: r.trackViewUrl ?? album?.collectionViewUrl ?? "",
        });
      }
    }
    // Skip a storefront that only lists the album shell (no playable tracks).
    if (album?.collectionViewUrl && tracks.length) {
      return { collectionViewUrl: album.collectionViewUrl, tracks };
    }
  }
  return null;
}

const CJK = /[぀-ヿ一-鿿]/;

async function loadPreview(record: ClientRecord): Promise<TrackPreview | null> {
  const override = MUSIC_OVERRIDES[String(record.id)];

  // A pinned track resolves by id or not at all: falling back to the album
  // would hard-cache the wrong song under the pin's key for PREVIEW_TTL. A
  // transient miss self-heals through the empty TTL instead.
  if (override?.appleTrackId) {
    return await fetchTrackById(override.appleTrackId);
  }

  const collectionId =
    override?.appleAlbumId ?? (await itunesSearchAlbumId(record));
  if (!collectionId) {
    return null;
  }
  const album = await fetchAppleAlbum(collectionId);
  if (!album) {
    return null;
  }
  const track = album.tracks[stableIndex(record.id, album.tracks.length)];
  // JP tracklists carry native titles; re-fetch by id for the US romanization.
  if (track.trackId && CJK.test(track.trackName)) {
    const romanized = await fetchTrackById(track.trackId);
    if (romanized) {
      return romanized;
    }
  }
  return toPreview(track, album.collectionViewUrl);
}

// Keep the track's own artist only when the record can't imply it ("Various"
// compilations, multi-composer scores).
function trimRedundantArtist(
  record: ClientRecord,
  preview: TrackPreview
): TrackPreview {
  if (preview.artistName && artistMatches(record, preview.artistName)) {
    return { ...preview, artistName: undefined };
  }
  return preview;
}

/** Resolve (and hard-cache) the preview for one record. */
export function resolvePreview(
  record: ClientRecord
): Promise<TrackPreview | null> {
  // The override is part of the cache key so a curation edit takes effect on
  // the next deploy instead of waiting out PREVIEW_TTL.
  const override = MUSIC_OVERRIDES[String(record.id)];
  let pin = "auto";
  if (override?.appleTrackId) {
    pin = `t${override.appleTrackId}`;
  } else if (override?.appleAlbumId) {
    pin = `a${override.appleAlbumId}`;
  }
  return withMemoryCache(
    `apple-preview:v4:${record.id}:${pin}`,
    PREVIEW_TTL,
    () =>
      loadPreview(record).then((preview) =>
        preview ? trimRedundantArtist(record, preview) : null
      )
  );
}

/**
 * Attach previews to records server-side so the crate island ships with them
 * on first paint. Near-instant once warm; a cold batch resolves with bounded
 * concurrency and fails fast if Apple misbehaves.
 */
export async function withPreviews(
  records: ClientRecord[]
): Promise<ClientRecord[]> {
  const out = records.slice();
  let next = 0;
  const worker = async () => {
    while (next < records.length) {
      const index = next++;
      const record = records[index];
      const preview = await resolvePreview(record).catch(() => null);
      if (preview) {
        out[index] = { ...record, preview };
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(RESOLVE_CONCURRENCY, records.length) },
      worker
    )
  );
  return out;
}
