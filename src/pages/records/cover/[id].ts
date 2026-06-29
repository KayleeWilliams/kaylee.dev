import type { APIRoute } from "astro";
import { discogsImageHeaders } from "@/lib/discogs-auth";
import { getCoverImageUrl } from "@/lib/get-discogs-collection";
import { personConfig } from "@/lib/site-config";

export const prerender = false;

// Cover art is content-addressed by release id and never changes, so cache it
// hard at the edge and in the browser. Keeps every visitor on our own origin
// (no browser → Discogs request) while staying effectively free after warm-up.
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";
const ALLOWED_HOST = /(^|\.)discogs\.com$/;

const notFound = () => new Response("Not found", { status: 404 });

export const GET: APIRoute = async ({ params, url }) => {
  const id = Number.parseInt(params.id ?? "", 10);
  if (!(Number.isInteger(id) && id > 0)) {
    return notFound();
  }

  // `?thumb` serves Discogs' ~150px thumbnail (for the small cover-wall tiles).
  const thumb = url.searchParams.has("thumb");
  const coverUrl = await getCoverImageUrl(
    personConfig.discogsUsername,
    id,
    thumb
  );
  if (!coverUrl) {
    return notFound();
  }

  // The URL comes from our own cached dataset, but re-validate the host so this
  // endpoint can never be coerced into proxying an arbitrary origin.
  let host: string;
  try {
    host = new URL(coverUrl).hostname;
  } catch {
    return notFound();
  }
  if (!ALLOWED_HOST.test(host)) {
    return notFound();
  }

  const upstream = await fetch(coverUrl, { headers: discogsImageHeaders() });
  if (!(upstream.ok && upstream.body)) {
    return notFound();
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": IMMUTABLE,
    },
  });
};
