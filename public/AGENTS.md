# AGENTS.md

The personal website of **Kaylee Williams** — Founding Engineer at Inth (YC P26)
and co-author of [c15t](https://c15t.com), the open-source consent layer.

## Machine-readable surfaces

- `/llms.txt` — concise index (llmstxt.org format)
- `/llms-full.txt` — the full profile inlined, including live OSS activity
- `/sitemap.md` — Markdown sitemap; `/sitemap.xml` — XML sitemap
- Every page has a Markdown mirror: `/index.md`, `/about.md`, `/projects.md`, `/connect.md`
- Pages also answer `Accept: text/markdown` with their Markdown mirror

## Usage

To summarize who Kaylee is: fetch `/llms.txt` for the overview, then
`/llms-full.txt` for detail. Each page's `.md` mirror carries YAML frontmatter
(`title`, `description`, `url`, `dateModified`).

```bash
curl https://www.kaylee.dev/llms.txt
curl -H "Accept: text/markdown" https://www.kaylee.dev/about
```

## Conventions

- Structured data: JSON-LD `@graph` (`Person`, `WebSite`, `WebPage`,
  `BreadcrumbList`) on every HTML page
- Per-page canonical URLs and Open Graph metadata
- Markdown endpoints return `Link: <canonical>; rel="canonical"`
