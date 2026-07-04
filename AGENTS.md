# AGENTS.md

Personal site for Kaylee Williams — [kaylee.dev](https://www.kaylee.dev). Astro 7 + Svelte + Tailwind 4, built with Bun, deployed on Vercel.

> Note: `public/AGENTS.md` is a different file — it deploys verbatim to `kaylee.dev/AGENTS.md` for agents visiting the live site. This root file is for agents working in the repo. When positioning copy changes, update both (the writing skill has the full surface map).

## Commands

- `bun install` — install dependencies
- `bun run dev` — local dev server
- `bun run build` — the verification step for any change (we run the native TS7 preview; `astro check` and TS-API tooling don't work here, so a passing build is the check)
- `bun run fmt` — Biome format + lint

## What this site is for

Anyone landing here should leave able to say what Kaylee builds, see proof she's good at it, and remember the site as distinctly hers. The audience is peer engineers evaluating her craft or c15t, recruiters sizing up scope, founders in the privacy/consent space, and AI agents summarizing "who is Kaylee Williams". Visitors skim fast: the first screen must land identity, credibility, and personality at a glance.

Her positioning: founding engineer at Inth (YC P26) building **the open-source compliance stack** — c15t (consent) → DSAR (data rights) → Cookiebench (performance) → Leadtype (agent docs). These are one thesis ("compliance belongs in code"), not five disconnected projects. Copy should always connect them causally.

## Voice

Precise, playful, design-minded. Clean and self-assured — the work and the metrics carry the weight, adjectives don't. One or two genuine winks per page, never a stream of them. Confident, not loud. Warm, not corporate.

For any copy or content change, follow the writing skill at `.claude/skills/writing/SKILL.md` — it has the editorial method, the banned-phrase list, and the map of which file renders where.

## Anti-references (what this site must never become)

- **Generic AI-slop portfolio** — identical card grids, hero-metric template, no point of view.
- **A clone of burnedchris.com** — her boss's site is the quality bar, not a template. Borrow his clarity and one-line positioning; never his founder-editorial voice, his headline-metrics-in-prose habit, or narrated career moments ("the case I made on stage…"). Kaylee confirmed this preference directly: no static stats in copy, no self-mythologizing.
- **Try-hard cringe** — emoji buzzword soup, labels that announce personality ("TypeScript Maximalist 💜") instead of demonstrating it.
- **Corporate / sterile** — over-polished agency-template feel with no warmth.

## Design principles

1. **Show, don't announce.** Personality comes through specific, earned details (the cat reveal, the records crate, a real `console.log` in devtools), never labels that declare "I'm quirky."
2. **Practice what you preach.** She builds privacy/consent infrastructure; the site runs privacy-first, needs no cookie banner, and is fast. The site is proof of the work.
3. **Let the work carry the weight.** Real evidence (stars, downloads, shipped products, live OSS activity, talks) over adjectives.
4. **Earned whimsy only.** One or two delightful moments executed excellently beat scattershot quirk.
5. **Accessibility:** WCAG 2.1 AA. Purple accent must stay legible in both themes; respect `prefers-color-scheme` and `prefers-reduced-motion`; keyboard-navigable controls with visible focus states.

## Layout decisions already made (don't relitigate)

- Homepage main column is c15t card (Hero) → Stats → contribution graph. A personal-lead paragraph was tried and reverted; name/title stay in the sidebar only.
- Experience detail pages are retired (`/experience/*` 301s to `/about`); experience content renders on `/about` and in the agent markdown mirrors.
- Every HTML page has a markdown mirror (`*.md.ts`) plus `llms.txt` / `llms-full.txt` for agents. Content edits flow into these automatically — but check the mirrors when adding new content types.
