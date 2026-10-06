# kaylee.dev

The source for [Kaylee Williams' personal site](https://www.kaylee.dev). I'm a founding engineer at [Inth](https://inth.com), part of YC P26. I also co-author [c15t](https://c15t.com), the open-source consent layer.

[![kaylee.dev](https://shieldcn.dev/badge/kaylee.dev-live-7c3aed.svg)](https://www.kaylee.dev)
[![GitHub](https://shieldcn.dev/badge/GitHub-KayleeWilliams-181717.svg?logo=github)](https://github.com/KayleeWilliams)
[![X](https://shieldcn.dev/x/follow/kaylee_dev.svg)](https://x.com/kaylee_dev)
[![Bluesky](https://shieldcn.dev/badge/Bluesky-@kaylee.dev-0285FF.svg?logo=bluesky)](https://bsky.app/profile/kaylee.dev)

The live site shows what I build. This README explains how the site itself works.

## How it works

- The site sets no tracking cookies, so it needs no cookie banner. If it did, it would use c15t.
- Astro renders every page. Svelte only hydrates the record crate on `/records`.
- Data from GitHub, npm, and Discogs comes from their APIs. Checked-in snapshots take over when a token is missing or an API is unavailable.
- The main pages have Markdown mirrors. `/llms.txt` and `/llms-full.txt` index that content for agents.
- Lighthouse results live in [`bench/`](#performance).

## Tech stack

- [Astro 7](https://astro.build) produces the server build. The [Vercel adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/) handles deployment, and the [Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/) supports self-hosting.
- [Svelte 5](https://svelte.dev) powers the record crate on `/records`.
- [Tailwind CSS 4](https://tailwindcss.com) runs through its Vite plugin.
- The application is written in [TypeScript](https://www.typescriptlang.org).
- [Biome](https://biomejs.dev), using the [Ultracite](https://www.ultracite.ai) preset, handles linting and formatting.
- [Bun](https://bun.sh) installs packages and runs scripts.
- [Vercel Analytics](https://vercel.com/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights) collect site and performance metrics.

## Getting started

Install [Bun](https://bun.sh) and Node.js 24 or newer. The `.nvmrc` file pins the Node version.

```bash
bun install
bun run dev
```

Open <http://localhost:4321>. You do not need environment variables. The data loaders use checked-in snapshots when credentials are absent.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Astro dev server. |
| `bun run build` | Create the production build with the Vercel adapter. |
| `bun run build:node` | Production build with the standalone Node adapter. |
| `bun run start` | Build with the Node adapter and serve on `127.0.0.1:4321`. |
| `bun run fmt` | Lint and format with Biome. |

## Environment variables

Both variables are optional. Without them, the data loaders use the checked-in snapshots.

| Variable | Used for |
| --- | --- |
| `GH_TOKEN` or `GITHUB_TOKEN` | Higher GitHub API rate limits for OSS activity, stars, and the contribution graph. |
| `DISCOGS_TOKEN` | A higher Discogs rate limit and access to the private record collection on `/records`. |

For local development, add them to the gitignored `.env` file. In production, set them as Vercel project environment variables.

## Project structure

```
content/          Markdown and JSON content collections
  experience/     Roles at Inth and Everfund
  projects/       Featured work
  site/           Hero, profile, socials, person schema
lib/              API clients, caching, Markdown helpers, and SEO
src/
  components/     Astro UI and the Svelte record crate
  layouts/        BaseLayout
  pages/          Routes, Markdown mirrors, and agent endpoints
  styles/         Global CSS and Tailwind layer
public/           Static assets and AGENTS.md
bench/            Isolated Lighthouse benchmark runner
```

### Pages

| Route | Page |
| --- | --- |
| `/` | Home with current work, OSS activity, and stats |
| `/about` | About |
| `/projects` | Featured projects |
| `/experience/[slug]` | Permanent redirect to `/about` |
| `/connect` | Contact links. `/contact` redirects here. |
| `/connect/share` | Shareable QR code |
| `/records` | Discogs record collection powered by Svelte |

## Agent-readable files

The site publishes its page copy as Markdown for LLMs and answer engines. [`public/AGENTS.md`](public/AGENTS.md) tells agents where to start.

- `/llms.txt`: concise index in the [llmstxt.org](https://llmstxt.org) format.
- `/llms-full.txt`: the full profile, including live OSS activity.
- `/index.md`, `/about.md`, `/projects.md`, and `/connect.md`: mirrors of the main pages with YAML frontmatter.
- `/records.md`: the live Discogs collection in Markdown.
- `/sitemap.xml` and `/sitemap.md`: site indexes for crawlers and agents.

The four mirrored main pages return Markdown when a request sends `Accept: text/markdown` or uses a recognized crawler user agent.

```bash
curl https://www.kaylee.dev/llms.txt
curl -H "Accept: text/markdown" https://www.kaylee.dev/about
```

## Performance

`bench/` has its own package file, so its [Lighthouse](https://developer.chrome.com/docs/lighthouse) dependencies do not ship with the site. It measures cold build time, output size, and per-page scores. Comparisons live in `bench/results/`.

```bash
cd bench && bun install && cd ..
node bench/bench.mjs <label>   # writes bench/results/<label>.json
```

## Deployment

[Vercel](https://vercel.com) deploys `main`. Run `bun run build:node` to produce a standalone server for self-hosting.

## License

This is a personal project. All rights reserved. Read the code for ideas, but please do not ship it as your own personal site.
