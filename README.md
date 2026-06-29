# kaylee.dev

The personal site of **Kaylee Williams** — founding engineer at [Inth](https://inth.com) (YC P26) and co-author of [c15t](https://c15t.com), the open-source consent layer.

[![kaylee.dev](https://shieldcn.dev/badge/kaylee.dev-live-7c3aed.svg)](https://www.kaylee.dev)
[![GitHub](https://shieldcn.dev/badge/GitHub-KayleeWilliams-181717.svg?logo=github)](https://github.com/KayleeWilliams)
[![X](https://shieldcn.dev/x/follow/kaylee_dev.svg)](https://x.com/kaylee_dev)
[![Bluesky](https://shieldcn.dev/badge/Bluesky-@kaylee.dev-0285FF.svg?logo=bluesky)](https://bsky.app/profile/kaylee.dev)

It's a personal site — the live version is the real story. This is just how it's built and how to run it.

## Highlights

- **Privacy-first by design.** No cookie banner because there are no tracking cookies — fitting for someone who builds consent infrastructure for a living.
- **Mostly static, selectively dynamic.** Framework-free Astro for everything; a single Svelte 5 island powers the `/records` crate.
- **Live, not hardcoded.** OSS activity, GitHub stars, npm downloads, the contribution graph, and a Discogs record collection are all fetched live — with baked-in snapshots so the site never breaks when a token or an API is missing.
- **Agent-readable.** Every page has a Markdown mirror, plus `/llms.txt`, `/llms-full.txt`, content negotiation, and dynamic OpenGraph images. (Details below.)
- **Fast on purpose.** Lighthouse runs are checked in under [`bench/`](#performance).

## Tech stack

- **[Astro 7](https://astro.build)** in `server` output, deployed via the [Vercel adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/) (with a [Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/) fallback for self-hosting).
- **[Svelte 5](https://svelte.dev)** for the one interactive island (`/records`).
- **[Tailwind CSS 4](https://tailwindcss.com)** via the Vite plugin.
- **[TypeScript](https://www.typescriptlang.org)** throughout.
- **[Biome](https://biomejs.dev)** (with the [Ultracite](https://www.ultracite.ai) preset) for lint + format.
- **[Bun](https://bun.sh)** as the package manager.
- **[Vercel Analytics](https://vercel.com/analytics)** + **[Speed Insights](https://vercel.com/docs/speed-insights)** for privacy-friendly metrics.

## Getting started

**Prerequisites:** [Bun](https://bun.sh) and Node.js 24+ (see `.nvmrc`).

```bash
bun install
bun run dev
```

Open <http://localhost:4321>. No environment variables are required — live data falls back to checked-in snapshots, so the site renders fully out of the box.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Astro dev server. |
| `bun run build` | Production build (Vercel adapter). |
| `bun run build:node` | Production build with the standalone Node adapter. |
| `bun run start` | Build with the Node adapter and serve on `127.0.0.1:4321`. |
| `bun run fmt` | Lint + format with Biome (`--write`). |

## Environment variables

All optional — each one upgrades a live data source, and the site degrades gracefully without it.

| Variable | Used for |
| --- | --- |
| `GH_TOKEN` / `GITHUB_TOKEN` | Higher GitHub API rate limits for OSS activity, stars, and the contribution graph. |
| `DISCOGS_TOKEN` | Higher Discogs rate limit + access to the private record collection on `/records`. |

For local development, drop them in a `.env` file (gitignored). In production they're set as Vercel project env vars.

## Project structure

```
content/          Markdown + JSON content collections
  experience/     Roles (Inth, Everfund)
  projects/       Featured work (c15t, cookiebench, …)
  site/           Hero, profile, socials, person schema
lib/              Data fetching (GitHub, npm, Discogs), caching, Markdown + SEO helpers
src/
  components/     Astro UI + the Svelte records crate
  layouts/        BaseLayout
  pages/          Routes + their .md mirrors and machine-readable endpoints
  styles/         Global CSS / Tailwind layer
public/           Static assets + AGENTS.md
bench/            Isolated Lighthouse benchmark harness
```

### Pages

| Route | Page |
| --- | --- |
| `/` | Home — hero, current work, OSS activity, stats |
| `/about` | About |
| `/projects` | Featured projects |
| `/experience/[slug]` | Individual roles |
| `/connect` | Linktree-style contact page (`/contact` → `/connect`) |
| `/connect/share` | Shareable QR code |
| `/records` | Discogs record collection (Svelte island) |

## Agent-readable surfaces

The site is built to be summarized correctly by LLMs and answer engines — see [`public/AGENTS.md`](public/AGENTS.md). Every page exposes a Markdown twin alongside the HTML:

- `/llms.txt` — concise index in the [llmstxt.org](https://llmstxt.org) format.
- `/llms-full.txt` — the full profile inlined, including live OSS activity.
- `/index.md`, `/about.md`, `/projects.md`, `/connect.md` — per-page Markdown mirrors with YAML frontmatter.
- Content negotiation — any page also answers `Accept: text/markdown` with its mirror.
- `/sitemap.xml` + `/sitemap.md`, and dynamic per-page OpenGraph images.

```bash
curl https://www.kaylee.dev/llms.txt
curl -H "Accept: text/markdown" https://www.kaylee.dev/about
```

## Performance

`bench/` is a self-contained [Lighthouse](https://developer.chrome.com/docs/lighthouse) harness, deliberately kept out of the app's dependency graph. It measures cold build time, output size, and per-page Lighthouse metrics; before/after runs live in `bench/results/`.

```bash
cd bench && bun install && cd ..
node bench/bench.mjs <label>   # writes bench/results/<label>.json
```

## Deployment

Deployed on [Vercel](https://vercel.com) from `main`. The Node adapter (`bun run build:node`) produces a standalone server for self-hosting anywhere else.

## License

Personal project — all rights reserved. Feel free to read the code for ideas; please don't ship it as your own personal site.
