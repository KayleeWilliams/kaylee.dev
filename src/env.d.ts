/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Discogs personal access token, used server-side to read the collection. */
  readonly DISCOGS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
