---
name: writing
description: Voice, editorial method, and content-flow map for writing or editing any copy on kaylee.dev — page prose, project/experience descriptions, SEO strings, or agent-mirror content. Use before touching anything in content/ or user-facing strings in src/.
---

# Writing for kaylee.dev

## The method: story = facts in causal order

Kaylee writes concisely and factually — keep that. "Storytelling" here never means long narrative prose. It means every section has a spine:

1. **Why** — the problem, stated concretely (e.g. "consent tooling is usually the worst code on a page").
2. **What** — the thing she built in response.
3. **Proof** — a real number or shipped artifact (1,800+ stars, 190K+ downloads/month, a talk, a benchmark).

One "why" sentence is usually enough. If a paragraph only lists whats, it's a job description, not copy — add the causal link or cut it.

The throughline across everything: **compliance belongs in code.** c15t (consent), DSAR (data rights), Cookiebench (performance), Leadtype (agent docs) are one stack built on that thesis, not separate projects.

## Voice rules

- Precise, playful, design-minded. Short sentences. No hedging, no hype.
- Max one or two winks per page, and they must be earned (a real observation, not decoration).
- State metrics in prose where they matter; don't rely only on live-fetched badges. Keep numbers honest and roundable ("1,800+ stars", "190K+ downloads a month") and update them when they've moved meaningfully.
- First person, her voice. She is not the founder-editorial register of burnedchris.com — borrow its clarity and headline-metric habit, never its tone.

## Banned

- "bloat", "no bloat", "zero bloat", "minimal bundle" as self-description — filler we removed twice already. (Exception: Cookiebench's "measure the bloat" line, where it's the literal subject.)
- Adjective-stacked capability claims ("blazing fast", "beautifully crafted", "high-performance X") — replace with the number or artifact that proves it.
- Labels that announce personality instead of demonstrating it.
- Long biographical narrative ("My Story" pages, dramatic turning points). Not her genre.

## Content-flow map (where each string renders)

| File | Renders |
|---|---|
| `content/site/about.md` | `/about` prose. The main story arc lives here — numbers in prose belong here. |
| `content/site/hero.md` | c15t card on the homepage. Live star/download badges render alongside, so `description` makes the qualitative claim, not the numeric one. `currentWork` feeds the agent markdown mirror. |
| `content/site/profile.md` | **Not rendered in HTML.** It is the `## Profile` section of the agent markdown mirror (`/about.md`, `/llms.txt`). |
| `content/site/person.json` | `description` = homepage SEO meta. `bio` = records-page subtitle — **it truncates, keep it short**. `headline`/`tagline` currently unused. `appearances` render on `/about`. |
| `content/experience/*.md` | Frontmatter `description` shows in the `/about` experience list. Bodies no longer render as HTML pages (`/experience/*` 301s to `/about`) but **do ship to agents via `/llms-full.txt`** — keep them clean. |
| `content/projects/*.md` | Project cards on `/projects`. |

## Checklist before finishing a copy change

1. Does every paragraph have a why → what → proof spine (or serve one)?
2. Any banned phrases introduced? Grep for `bloat` and `minimal bundle`.
3. If you touched `person.json` `bio`, check it against the records-page truncation.
4. `bun run build` passes (this is the only check — `astro check` doesn't work on the TS7 preview).
5. Skim the corresponding markdown mirror (`/about.md`, `/llms.txt`) output if the content feeds it.
