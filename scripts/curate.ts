// Curation CLI for the records crate's song previews.
//
//   bun run curate                   # interactive editor (arrow keys) — default
//   bun run curate status            # what every record currently plays
//   bun run curate find <discogsId>  # song search → pin a track (non-interactive)
//   bun run curate clear <discogsId> # drop a record's override
//
// The interactive editor also offers "Browse an album" for an album override
// (a stable-random track). Writes to content/site/record-music.json — restart
// the dev server to see an edit locally; production picks it up on deploy
// (the override is part of the preview cache key).

import { readFileSync, writeFileSync } from "node:fs";
import {
  intro,
  isCancel,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import person from "../content/site/person.json";
import {
  type ClientRecord,
  getDiscogsCollection,
  toClientRecords,
} from "../lib/get-discogs-collection";
import { withPreviews } from "../lib/get-track-preview";

const OVERRIDES_PATH = "content/site/record-music.json";
const USERNAME = (person as { discogsUsername: string }).discogsUsername;
const ITUNES = "https://itunes.apple.com";
const STOREFRONTS = ["US", "JP"] as const;

interface Override {
  appleAlbumId?: number;
  appleTrackId?: number;
}
interface AppleAlbumHit {
  artistName?: string;
  collectionId?: number;
  collectionName?: string;
}
interface AppleTrackHit {
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  trackId?: number;
  trackName?: string;
  wrapperType?: string;
}
interface AppleResponse<T> {
  results?: T[];
}

function loadOverrides(): Record<string, Override> {
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
  } catch {
    return {};
  }
}

function setOverride(id: number, value: Override | null): void {
  const overrides = loadOverrides();
  if (value) {
    overrides[String(id)] = value;
  } else {
    delete overrides[String(id)];
  }
  // Keep keys sorted so diffs stay readable.
  const sorted: Record<string, Override> = {};
  for (const key of Object.keys(overrides).sort()) {
    sorted[key] = overrides[key];
  }
  writeFileSync(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function loadRecords(): Promise<ClientRecord[]> {
  const collection = await getDiscogsCollection(USERNAME);
  if (!collection) {
    throw new Error("Discogs collection failed to load");
  }
  return toClientRecords(collection.records);
}

async function appleSearch(query: string): Promise<AppleAlbumHit[]> {
  const out: AppleAlbumHit[] = [];
  const seen = new Set<number>();
  for (const country of STOREFRONTS) {
    const url = `${ITUNES}/search?term=${encodeURIComponent(query)}&country=${country}&entity=album&limit=5`;
    const data = (await (
      await fetch(url)
    ).json()) as AppleResponse<AppleAlbumHit>;
    for (const album of data.results ?? []) {
      if (album.collectionId && !seen.has(album.collectionId)) {
        seen.add(album.collectionId);
        out.push(album);
      }
    }
  }
  return out;
}

// Song-level search — finds a specific track on whatever album it lives on
// (an album search can't surface "Higher Ground" because *Mother's Milk*
// doesn't have it in the album name). US first, so names come back in English.
async function appleSongs(query: string): Promise<AppleTrackHit[]> {
  const out: AppleTrackHit[] = [];
  const seen = new Set<number>();
  for (const country of STOREFRONTS) {
    const url = `${ITUNES}/search?term=${encodeURIComponent(query)}&country=${country}&entity=song&limit=8`;
    const data = (await (
      await fetch(url)
    ).json()) as AppleResponse<AppleTrackHit>;
    for (const t of data.results ?? []) {
      if (t.trackId && t.previewUrl && !seen.has(t.trackId)) {
        seen.add(t.trackId);
        out.push(t);
      }
    }
  }
  return out;
}

const CJK = /[぀-ヿ一-鿿]/;

// Replace native (JP) track titles with the US store's English/romanized names
// (US/UK share the English catalogue) so the picker is readable. One batch
// lookup by id — the US *album* lookup is an empty shell for JP releases, but
// the per-track US lookup has the English name.
async function romanizeNames(
  tracks: AppleTrackHit[]
): Promise<AppleTrackHit[]> {
  const ids = tracks.map((t) => t.trackId).filter(Boolean);
  if (!ids.length) {
    return tracks;
  }
  const url = `${ITUNES}/lookup?id=${ids.join(",")}&country=US&entity=song`;
  const data = (await (
    await fetch(url)
  ).json()) as AppleResponse<AppleTrackHit>;
  const english = new Map(
    (data.results ?? [])
      .filter((t) => t.wrapperType === "track" && t.trackName)
      .map((t) => [t.trackId, t.trackName])
  );
  return tracks.map((t) => ({
    ...t,
    trackName: english.get(t.trackId) ?? t.trackName,
  }));
}

async function appleTracks(albumId: number): Promise<AppleTrackHit[]> {
  for (const country of STOREFRONTS) {
    const url = `${ITUNES}/lookup?id=${albumId}&country=${country}&entity=song&limit=200`;
    const data = (await (
      await fetch(url)
    ).json()) as AppleResponse<AppleTrackHit>;
    const tracks = (data.results ?? []).filter(
      (t) => t.wrapperType === "track" && t.previewUrl
    );
    if (tracks.length) {
      // Only the JP fallback yields native titles worth translating.
      return tracks.some((t) => CJK.test(t.trackName ?? ""))
        ? await romanizeNames(tracks)
        : tracks;
    }
  }
  return [];
}

function recordLabel(record: ClientRecord): string {
  const artist = record.artistRoman ?? record.artist;
  const title = record.titleRoman ?? record.title;
  return `${artist} – ${title}`;
}

function sourceOf(record: ClientRecord, override?: Override): string {
  if (override?.appleTrackId) {
    return "pinned";
  }
  if (override?.appleAlbumId) {
    return "album";
  }
  return record.preview ? "auto" : "—";
}

function write(line: string): void {
  process.stdout.write(line);
}

async function status(): Promise<void> {
  const records = await withPreviews(await loadRecords());
  const overrides = loadOverrides();
  let resolved = 0;
  for (const record of records) {
    if (record.preview) {
      resolved++;
    }
    const mark = record.preview ? " " : "✗";
    const source = sourceOf(record, overrides[String(record.id)]);
    write(
      `${mark} ${String(record.id).padEnd(9)} ${recordLabel(record)}\n` +
        `      ${source.padEnd(7)} ${record.preview?.trackName ?? "UNRESOLVED"}\n`
    );
  }
  write(`\n${resolved}/${records.length} resolved\n`);
}

function ask(question: string): string {
  // biome-ignore lint/suspicious/noAlert: interactive CLI input (TTY or piped)
  return (prompt(question) ?? "").trim();
}

async function find(id: number): Promise<void> {
  const record = (await loadRecords()).find((r) => r.id === id);
  if (!record) {
    write(`No record with id ${id}\n`);
    return;
  }
  write(`Record ${id}: ${recordLabel(record)}\n`);
  const suggested = `${record.artistRoman ?? record.artist} ${record.titleRoman ?? record.title}`;

  const query =
    ask(`Search a song [${suggested}] (Enter to accept):`) || suggested;
  const songs = await appleSongs(query);
  if (!songs.length) {
    write("No songs found.\n");
    return;
  }
  for (const [i, t] of songs.entries()) {
    write(
      `  ${i + 1}. ${t.artistName} — ${t.trackName}  (${t.collectionName}, track ${t.trackId})\n`
    );
  }
  const track =
    songs[Number.parseInt(ask("Song number to pin, Enter to cancel:"), 10) - 1];
  if (track?.trackId) {
    setOverride(id, { appleTrackId: track.trackId });
    write(
      `✓ pinned "${track.trackName}" (${track.trackId}) → ${id}. Restart dev to see it; deploys pick it up automatically.\n`
    );
  }
}

function clear(id: number): void {
  setOverride(id, null);
  write(`✓ cleared override for ${id}\n`);
}

type View = Map<number, { source: string; track: string }>;

// One record's edit flow: search Apple, then pin a track or set an album
// override (or clear). `view` is updated in place so the list reflects the
// change immediately — the on-disk override only takes effect on dev restart.
function suggestedQuery(record: ClientRecord): string {
  return `${record.artistRoman ?? record.artist} ${record.titleRoman ?? record.title}`;
}

// "Pin a song" — search by title and pin the exact track (on whatever album).
// This is what finds heavily-covered/compiled songs the album search misses.
async function pinSong(record: ClientRecord, view: View): Promise<void> {
  const query = await text({
    initialValue: suggestedQuery(record),
    message: "Search a song (artist + title finds the original)",
  });
  if (isCancel(query)) {
    return;
  }
  const searching = spinner();
  searching.start("Searching songs…");
  const songs = await appleSongs(query);
  searching.stop(`${songs.length} song(s)`);
  if (!songs.length) {
    note("No songs found.", "—");
    return;
  }
  const trackId = await select({
    maxItems: 10,
    message: "Pin which song?",
    options: songs.map((t) => ({
      value: t.trackId ?? 0,
      label: `${t.artistName} — ${t.trackName}`,
      hint: t.collectionName,
    })),
  });
  if (isCancel(trackId) || !trackId) {
    return;
  }
  const track = songs.find((t) => t.trackId === trackId);
  setOverride(record.id, { appleTrackId: trackId });
  view.set(record.id, {
    source: "pinned*",
    track: track?.trackName ?? "pinned",
  });
}

// "Browse an album" — pick an album, then a specific track or an album override
// (a stable-random track from it).
async function browseAlbum(record: ClientRecord, view: View): Promise<void> {
  const query = await text({
    initialValue: suggestedQuery(record),
    message: "Search an album",
  });
  if (isCancel(query)) {
    return;
  }
  const searching = spinner();
  searching.start("Searching albums…");
  const albums = await appleSearch(query);
  searching.stop(`${albums.length} album(s)`);
  if (!albums.length) {
    note("No albums found.", "—");
    return;
  }
  const albumId = await select({
    maxItems: 8,
    message: "Which album?",
    options: albums.map((a) => ({
      value: a.collectionId ?? 0,
      label: `${a.artistName} — ${a.collectionName}`,
    })),
  });
  if (isCancel(albumId) || !albumId) {
    return;
  }
  const loading = spinner();
  loading.start("Loading tracks…");
  const tracks = await appleTracks(albumId);
  loading.stop(`${tracks.length} track(s)`);
  const trackId = await select({
    maxItems: 10,
    message: "Pin which track?",
    options: [
      { value: 0, label: "★ Album override (random track from this album)" },
      ...tracks.map((t) => ({
        value: t.trackId ?? 0,
        label: t.trackName ?? "?",
      })),
    ],
  });
  if (isCancel(trackId)) {
    return;
  }
  if (trackId === 0) {
    setOverride(record.id, { appleAlbumId: albumId });
    view.set(record.id, { source: "album*", track: "(album override)" });
    return;
  }
  const track = tracks.find((t) => t.trackId === trackId);
  setOverride(record.id, { appleTrackId: trackId });
  view.set(record.id, {
    source: "pinned*",
    track: track?.trackName ?? "pinned",
  });
}

async function editRecord(record: ClientRecord, view: View): Promise<void> {
  const action = await select({
    message: `${recordLabel(record)}  ·  now: ${view.get(record.id)?.track}`,
    options: [
      { value: "song", label: "Pin a song (search by title)" },
      { value: "album", label: "Browse an album (pick a track or override)" },
      { value: "clear", label: "Clear override → back to auto" },
      { value: "back", label: "← Back to list" },
    ],
  });
  if (isCancel(action) || action === "back") {
    return;
  }
  if (action === "clear") {
    setOverride(record.id, null);
    view.set(record.id, { source: "auto*", track: "(auto on restart)" });
    return;
  }
  if (action === "song") {
    await pinSong(record, view);
    return;
  }
  await browseAlbum(record, view);
}

async function interactive(): Promise<void> {
  if (!process.stdin.isTTY) {
    write(
      "The interactive editor needs a terminal. Try: bun run curate status\n"
    );
    return;
  }
  intro("The Crate — preview curation");
  const loading = spinner();
  loading.start("Resolving previews…");
  const records = await withPreviews(await loadRecords());
  loading.stop(`${records.length} records loaded`);

  const overrides = loadOverrides();
  const view: View = new Map();
  for (const record of records) {
    view.set(record.id, {
      source: sourceOf(record, overrides[String(record.id)]),
      track: record.preview?.trackName ?? "✗ unresolved",
    });
  }

  for (;;) {
    const id = await select({
      maxItems: 12,
      message: "Pick a record to edit (Esc to quit)",
      options: records.map((record) => ({
        value: record.id,
        label: recordLabel(record),
        hint: `${view.get(record.id)?.source} · ${view.get(record.id)?.track}`,
      })),
    });
    if (isCancel(id)) {
      break;
    }
    const record = records.find((r) => r.id === id);
    if (record) {
      await editRecord(record, view);
    }
  }
  outro(
    "Restart the dev server to see changes; deploys pick them up automatically."
  );
}

const [command, arg] = process.argv.slice(2);
switch (command) {
  case undefined:
    await interactive();
    break;
  case "status":
    await status();
    break;
  case "find":
    await find(Number.parseInt(arg ?? "", 10));
    break;
  case "clear":
    clear(Number.parseInt(arg ?? "", 10));
    break;
  default:
    write(
      "usage: bun run curate [status | find <id> | clear <id>]  (no args = interactive)\n"
    );
}
