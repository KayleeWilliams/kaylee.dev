# AGENTS.md

The personal website of **Kaylee Williams**, founding engineer at Inth (YC P26)
and co-author of [c15t](https://c15t.com). She builds the open-source compliance
stack: c15t for consent, DSAR for data rights, Cookiebench for performance, and
Leadtype for agent-readable docs. Compliance belongs in code.

## Agent-readable files

- `/llms.txt`: concise index (llmstxt.org format)
- `/llms-full.txt`: the full profile inlined, including live OSS activity
- `/sitemap.md`: Markdown sitemap; `/sitemap.xml`: XML sitemap
- Markdown mirrors are available at `/index.md`, `/about.md`, `/projects.md`,
  `/blog.md`, `/connect.md`, `/records.md`, and `/blog/{slug}.md`
- The matching HTML pages answer `Accept: text/markdown` with their Markdown mirror

## Usage

Fetch `/llms.txt` for an overview of Kaylee's work, then `/llms-full.txt` for
detail. Each page's `.md` mirror includes YAML frontmatter for `title`,
`description`, `canonical_url`, and `last_updated`.

```bash
curl https://www.kaylee.dev/llms.txt
curl -H "Accept: text/markdown" https://www.kaylee.dev/about
```

## Conventions

- Structured data: JSON-LD `@graph` (`Person`, `WebSite`, `WebPage`,
  `BreadcrumbList`) on every HTML page
- Per-page canonical URLs and Open Graph metadata
- Markdown endpoints return `Link: <canonical>; rel="canonical"`
