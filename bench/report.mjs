// Generates a self-contained HTML report from results/before.json + results/after.json.
//   node bench/report.mjs
import fs from "node:fs";
import path from "node:path";

const RESULTS = path.join(import.meta.dirname, "results");
const read = (f) => JSON.parse(fs.readFileSync(path.join(RESULTS, f), "utf8"));
const before = read("before.json");
const after = read("after.json");
const generatedAt = process.env.BENCH_NOW || "(timestamp omitted)";

// ---- formatting ------------------------------------------------------------
const fmtMs = (v) => (v == null ? "—" : `${Math.round(v).toLocaleString()} ms`);
const fmtS = (v) => (v == null ? "—" : `${(v / 1000).toFixed(2)} s`);
const fmtKiB = (v) => (v == null ? "—" : `${(v / 1024).toFixed(1)} KiB`);
const fmtInt = (v) => (v == null ? "—" : Math.round(v).toLocaleString());
const fmt3 = (v) => (v == null ? "—" : v.toFixed(3));
const fmtScore = (v) => (v == null ? "—" : String(v));

// dir: +1 means higher-is-better, -1 means lower-is-better
function deltaCell(b, a, dir) {
  if (b == null || a == null) {
    return { html: "—", cls: "neutral" };
  }
  const diff = a - b;
  let pct;
  if (b === 0) {
    pct = a === 0 ? 0 : 100;
  } else {
    pct = (diff / Math.abs(b)) * 100;
  }
  const improved = dir > 0 ? diff > 0 : diff < 0;
  const worse = dir > 0 ? diff < 0 : diff > 0;
  const near = Math.abs(pct) < 0.5;
  let cls = "neutral";
  if (!near) {
    if (improved) {
      cls = "good";
    } else if (worse) {
      cls = "bad";
    }
  }
  const sign = diff > 0 ? "+" : "";
  let arrow = "→";
  if (!near) {
    arrow = improved ? "▲" : "▼";
  }
  const pctStr = `${sign}${pct.toFixed(1)}%`;
  return { html: `${arrow} ${pctStr}`, cls, diff, pct };
}

const METRICS = [
  {
    key: "performanceScore",
    label: "Performance score",
    dir: +1,
    fmt: fmtScore,
    cwv: false,
    note: "0–100",
  },
  {
    key: "lcp",
    label: "Largest Contentful Paint",
    dir: -1,
    fmt: fmtMs,
    cwv: true,
    note: "CWV",
  },
  {
    key: "cls",
    label: "Cumulative Layout Shift",
    dir: -1,
    fmt: fmt3,
    cwv: true,
    note: "CWV",
  },
  {
    key: "tbt",
    label: "Total Blocking Time",
    dir: -1,
    fmt: fmtMs,
    cwv: true,
    note: "INP proxy",
  },
  { key: "fcp", label: "First Contentful Paint", dir: -1, fmt: fmtMs },
  { key: "speedIndex", label: "Speed Index", dir: -1, fmt: fmtMs },
  { key: "tti", label: "Time to Interactive", dir: -1, fmt: fmtMs },
  { key: "maxFid", label: "Max Potential FID", dir: -1, fmt: fmtMs },
  { key: "ttfb", label: "Server Response (TTFB)", dir: -1, fmt: fmtMs },
  {
    key: "totalByteWeight",
    label: "Total transfer weight",
    dir: -1,
    fmt: fmtKiB,
  },
  { key: "requests", label: "Network requests", dir: -1, fmt: fmtInt },
  { key: "domSize", label: "DOM elements", dir: -1, fmt: fmtInt },
  { key: "mainThreadWork", label: "Main-thread work", dir: -1, fmt: fmtMs },
  { key: "bootupTime", label: "JS execution time", dir: -1, fmt: fmtMs },
];

const pageByName = (data, name) =>
  data.runtime.pages.find((p) => p.name === name);
const avgScore = (data) =>
  Math.round(
    data.runtime.pages.reduce((s, p) => s + p.metrics.performanceScore, 0) /
      data.runtime.pages.length
  );

// ---- summary tiles ---------------------------------------------------------
function tile(title, b, a, dir, fmt, sub) {
  const d = deltaCell(b, a, dir);
  return `<div class="tile">
    <div class="tile-title">${title}</div>
    <div class="tile-vals"><span class="was">${fmt(b)}</span><span class="arrow">→</span><span class="now">${fmt(a)}</span></div>
    <div class="badge ${d.cls}">${d.html}</div>
    ${sub ? `<div class="tile-sub">${sub}</div>` : ""}
  </div>`;
}

const summary = [
  tile(
    "Build time (fastest)",
    before.build.minMs,
    after.build.minMs,
    -1,
    fmtS,
    `median ${fmtS(before.build.medianMs)} → ${fmtS(after.build.medianMs)}`
  ),
  tile(
    "Build output size",
    before.dist.totalBytes,
    after.dist.totalBytes,
    -1,
    fmtKiB,
    `${before.dist.totalFiles} → ${after.dist.totalFiles} files`
  ),
  tile(
    "Client JS shipped",
    before.dist.client.jsBytes,
    after.dist.client.jsBytes,
    -1,
    fmtKiB,
    "static _astro/*.js"
  ),
  tile(
    "Avg performance score",
    avgScore(before),
    avgScore(after),
    +1,
    fmtScore,
    "mean across pages"
  ),
];

// ---- per-page metric tables ------------------------------------------------
function metricTable(pageName) {
  const pb = pageByName(before, pageName);
  const pa = pageByName(after, pageName);
  const rows = METRICS.map((m) => {
    const b = pb.metrics[m.key];
    const a = pa.metrics[m.key];
    const d = deltaCell(b, a, m.dir);
    let tag = "";
    if (m.cwv) {
      tag = `<span class="cwv">${m.note}</span>`;
    } else if (m.note) {
      tag = `<span class="muted">${m.note}</span>`;
    }
    return `<tr class="${m.cwv ? "is-cwv" : ""}">
      <td class="metric">${m.label} ${tag}</td>
      <td class="num">${m.fmt(b)}</td>
      <td class="num">${m.fmt(a)}</td>
      <td class="num"><span class="badge ${d.cls}">${d.html}</span></td>
    </tr>`;
  }).join("");
  return `<table class="metrics">
    <thead><tr><th>Metric</th><th>Before</th><th>After</th><th>Δ</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

const pageSections = before.runtime.pages
  .map(
    (p) => `<section class="page">
      <h3>${p.name} <span class="path">${p.path}</span></h3>
      ${metricTable(p.name)}
    </section>`
  )
  .join("");

// ---- output-size breakdown -------------------------------------------------
function sizeRows() {
  const rows = [
    ["Total dist", before.dist.totalBytes, after.dist.totalBytes],
    [
      "Server bundle",
      before.dist.server.totalBytes,
      after.dist.server.totalBytes,
    ],
    [
      "Client total",
      before.dist.client.totalBytes,
      after.dist.client.totalBytes,
    ],
    ["Client JS", before.dist.client.jsBytes, after.dist.client.jsBytes],
    ["Client CSS", before.dist.client.cssBytes, after.dist.client.cssBytes],
    ["File count", before.dist.totalFiles, after.dist.totalFiles],
  ];
  return rows
    .map(([name, b, a]) => {
      const isCount = name === "File count";
      const fmt = isCount ? fmtInt : fmtKiB;
      const d = deltaCell(b, a, -1);
      return `<tr><td class="metric">${name}</td><td class="num">${fmt(b)}</td><td class="num">${fmt(a)}</td><td class="num"><span class="badge ${d.cls}">${d.html}</span></td></tr>`;
    })
    .join("");
}

// ---- build runs ------------------------------------------------------------
const buildRunsRows = before.build.runsMs
  .map((b, i) => {
    const a = after.build.runsMs[i];
    return `<tr><td class="metric">Cold build #${i + 1}</td><td class="num">${fmtS(b)}</td><td class="num">${fmtS(a)}</td><td class="num"><span class="badge ${deltaCell(b, a, -1).cls}">${deltaCell(b, a, -1).html}</span></td></tr>`;
  })
  .join("");

// ---- html ------------------------------------------------------------------
const afterPrerelease = after.env.astro.includes("-");
const buildDeltaMedian = deltaCell(
  before.build.medianMs,
  after.build.medianMs,
  -1
);
const buildDeltaFastest = deltaCell(before.build.minMs, after.build.minMs, -1);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Astro ${before.env.astro} → ${after.env.astro} · Performance Benchmark</title>
<style>
  /* INTH Design — restrained neutral system, teal primary, state colours for deltas. */
  :root {
    color-scheme: light dark;
    /* neutral ramp */
    --n-0:oklch(1 0 0); --n-50:oklch(0.976 0 0); --n-100:oklch(0.968 0 0); --n-200:oklch(0.937 0 0);
    --n-300:oklch(0.869 0 0); --n-400:oklch(0.704 0 0); --n-500:oklch(0.556 0 0); --n-600:oklch(0.446 0 0);
    --n-700:oklch(0.321 0 0); --n-800:oklch(0.269 0 0); --n-900:oklch(0.199 0 0); --n-950:oklch(0.178 0 0);
    /* primary teal */
    --p-50:oklch(0.96 0.025 180); --p-100:oklch(0.93 0.04 180); --p-300:oklch(0.8 0.1 180);
    --p-500:oklch(0.64 0.14 180); --p-600:oklch(0.56 0.135 180); --p-700:oklch(0.49 0.125 180);
    /* semantic — light theme */
    --canvas:var(--n-0); --surface:var(--n-0); --surface-subtle:var(--n-50);
    --text-primary:var(--n-950); --text-secondary:var(--n-600); --text-muted:var(--n-400);
    --border:var(--n-200); --border-strong:var(--n-300);
    --primary:var(--p-600); --primary-strong:var(--p-700);
    --good-fg:oklch(0.3 0.1 155); --good-bg:oklch(0.89 0.09 155 / 0.5); --good-bd:oklch(0.59 0.155 155 / 0.32);
    --bad-fg:oklch(0.352 0.1 25); --bad-bg:oklch(0.9 0.08 25 / 0.5); --bad-bd:oklch(0.637 0.237 25.3 / 0.3);
    --neutral-fg:var(--n-600); --neutral-bg:var(--n-100); --neutral-bd:var(--n-200);
    --info-fg:oklch(0.352 0.12 262); --info-bd:oklch(0.623 0.214 259.8 / 0.4);
    --cwv-fg:var(--p-700); --cwv-bg:var(--p-50); --cwv-bd:oklch(0.64 0.14 180 / 0.22);
    --shadow-xs:0 1px 2px 0 oklch(0.168 0.022 265 / 0.04);
    --focus:0 0 0 2px var(--surface), 0 0 0 4px oklch(0.64 0.14 180 / 0.24);
  }
  :root.dark, :root:where(.dark) {
    --canvas:var(--n-950); --surface:var(--n-900); --surface-subtle:var(--n-800);
    --text-primary:var(--n-0); --text-secondary:var(--n-400); --text-muted:var(--n-500);
    --border:var(--n-700); --border-strong:var(--n-600);
    --primary:var(--p-500); --primary-strong:var(--p-300);
    --good-fg:oklch(0.89 0.09 155); --good-bg:oklch(0.3 0.1 155 / 0.5); --good-bd:oklch(0.59 0.155 155 / 0.4);
    --bad-fg:oklch(0.9 0.08 25); --bad-bg:oklch(0.352 0.1 25 / 0.55); --bad-bd:oklch(0.637 0.237 25.3 / 0.4);
    --neutral-fg:var(--n-400); --neutral-bg:var(--n-800); --neutral-bd:var(--n-700);
    --info-fg:oklch(0.893 0.089 248); --info-bd:oklch(0.623 0.214 259.8 / 0.45);
    --cwv-fg:var(--p-300); --cwv-bg:oklch(0.3 0.08 180 / 0.35); --cwv-bd:oklch(0.64 0.14 180 / 0.3);
    --shadow-xs:0 1px 2px 0 oklch(0 0 0 / 0.3);
  }
  @media (prefers-color-scheme: dark) {
    :root:not(.light) {
      --canvas:var(--n-950); --surface:var(--n-900); --surface-subtle:var(--n-800);
      --text-primary:var(--n-0); --text-secondary:var(--n-400); --text-muted:var(--n-500);
      --border:var(--n-700); --border-strong:var(--n-600);
      --primary:var(--p-500); --primary-strong:var(--p-300);
      --good-fg:oklch(0.89 0.09 155); --good-bg:oklch(0.3 0.1 155 / 0.5); --good-bd:oklch(0.59 0.155 155 / 0.4);
      --bad-fg:oklch(0.9 0.08 25); --bad-bg:oklch(0.352 0.1 25 / 0.55); --bad-bd:oklch(0.637 0.237 25.3 / 0.4);
      --neutral-fg:var(--n-400); --neutral-bg:var(--n-800); --neutral-bd:var(--n-700);
      --info-fg:oklch(0.893 0.089 248); --info-bd:oklch(0.623 0.214 259.8 / 0.45);
      --cwv-fg:var(--p-300); --cwv-bg:oklch(0.3 0.08 180 / 0.35); --cwv-bd:oklch(0.64 0.14 180 / 0.3);
      --shadow-xs:0 1px 2px 0 oklch(0 0 0 / 0.3);
    }
  }

  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--canvas); color: var(--text-primary);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
    font-size: 0.875rem; line-height: 1.25rem; letter-spacing: -0.006em;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  .wrap { max-width: 64rem; margin: 0 auto; padding: 48px 24px 96px; }

  /* header */
  .eyebrow { font-size: 0.6875rem; line-height: 0.75rem; font-weight: 500; letter-spacing: 0.02em;
    text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px; }
  header h1 { margin: 0; font-size: 2rem; line-height: 2.5rem; font-weight: 500; letter-spacing: -0.01em;
    color: var(--text-primary); }
  header h1 .v-was { color: var(--text-muted); font-weight: 500; }
  header h1 .v-now { color: var(--primary-strong); font-weight: 500; }
  header h1 .ar { color: var(--text-muted); margin: 0 2px; }
  .sub { color: var(--text-secondary); margin: 8px 0 0; font-size: 0.875rem; line-height: 1.25rem; }
  .envline { color: var(--text-secondary); font-size: 0.8125rem; line-height: 1rem; margin-top: 20px;
    display: flex; flex-wrap: wrap; gap: 8px 16px; }
  .envline span { display: inline-flex; align-items: center; gap: 6px; }
  .envline code { color: var(--text-primary); background: var(--surface-subtle); border: 1px solid var(--border);
    padding: 2px 7px; border-radius: 6px; font-size: 0.75rem;
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace; }
  .note { margin-top: 20px; padding: 16px; background: var(--surface); border: 1px solid var(--border);
    border-left: 3px solid var(--info-bd); border-radius: 10px; color: var(--text-secondary);
    font-size: 0.8125rem; line-height: 1.25rem; box-shadow: var(--shadow-xs); }
  .note strong { color: var(--text-primary); font-weight: 500; }
  .note code { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace; font-size: 0.75rem;
    color: var(--text-primary); }

  /* section eyebrow headings */
  h2 { font-size: 0.6875rem; line-height: 0.75rem; text-transform: uppercase; letter-spacing: 0.02em;
    color: var(--text-secondary); margin: 40px 0 12px; font-weight: 500; }

  /* tiles */
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(208px, 1fr)); gap: 12px; }
  .tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px;
    box-shadow: var(--shadow-xs); }
  .tile-title { color: var(--text-secondary); font-size: 0.6875rem; line-height: 0.75rem; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.02em; }
  .tile-vals { display: flex; align-items: baseline; gap: 8px; margin: 12px 0; }
  .tile-vals .was { color: var(--text-muted); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
  .tile-vals .arrow { color: var(--text-muted); }
  .tile-vals .now { font-size: 1.5rem; line-height: 1.75rem; font-weight: 500; letter-spacing: -0.01em;
    color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .tile-sub { color: var(--text-secondary); font-size: 0.75rem; line-height: 1rem; margin-top: 8px; }

  /* badges — state colour + glyph + value (never colour alone) */
  .badge { display: inline-flex; align-items: center; gap: 3px; padding: 0 8px; height: 20px;
    border-radius: 9999px; font-size: 0.75rem; line-height: 1; font-weight: 500; white-space: nowrap;
    border: 1px solid transparent; font-variant-numeric: tabular-nums; }
  .badge.good { color: var(--good-fg); background: var(--good-bg); border-color: var(--good-bd); }
  .badge.bad { color: var(--bad-fg); background: var(--bad-bg); border-color: var(--bad-bd); }
  .badge.neutral { color: var(--neutral-fg); background: var(--neutral-bg); border-color: var(--neutral-bd); }

  /* panels + tables */
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
    box-shadow: var(--shadow-xs); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 16px; border-bottom: 1px solid var(--border); }
  thead th { height: 40px; color: var(--text-secondary); font-size: 0.6875rem; text-transform: uppercase;
    letter-spacing: 0.02em; font-weight: 500; background: var(--surface-subtle); }
  tbody tr { transition: background 120ms ease-out; }
  tbody tr:hover { background: var(--surface-subtle); }
  tbody tr:last-child td { border-bottom: 0; }
  td.num, th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
  td.metric { color: var(--text-primary); }
  td.metric strong { font-weight: 500; }
  tr.is-cwv td.metric { font-weight: 500; }
  .total-row td { border-top: 1px solid var(--border-strong); }

  /* inline metric tags */
  .cwv { font-size: 0.625rem; line-height: 1; color: var(--cwv-fg); background: var(--cwv-bg);
    border: 1px solid var(--cwv-bd); padding: 2px 6px; border-radius: 6px; font-weight: 500;
    letter-spacing: 0.02em; text-transform: uppercase; vertical-align: middle; margin-left: 6px; }
  .muted { color: var(--text-muted); font-size: 0.625rem; letter-spacing: 0.02em; text-transform: uppercase;
    margin-left: 6px; }

  /* per-page sections */
  .page { margin-bottom: 16px; }
  .page h3 { font-size: 1.125rem; line-height: 1.5rem; font-weight: 500; letter-spacing: 0; margin: 0 0 10px;
    color: var(--text-primary); display: flex; align-items: baseline; gap: 8px; }
  .page h3 .path { color: var(--text-secondary); font-weight: 400; font-size: 0.8125rem;
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace; }

  footer { color: var(--text-muted); font-size: 0.75rem; line-height: 1rem; margin-top: 48px;
    border-top: 1px solid var(--border); padding-top: 16px; }
  footer code { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace; color: var(--text-secondary); }
  a { color: var(--primary); text-decoration: none; border-radius: 4px; }
  a:hover { color: var(--primary-strong); text-decoration: underline; }
  a:focus-visible { outline: none; box-shadow: var(--focus); }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">Performance benchmark</div>
    <h1>Astro <span class="v-was">${before.env.astro}</span> <span class="ar">→</span> <span class="v-now">${after.env.astro}</span></h1>
    <p class="sub">Before / after comparison of build time, bundle size, and runtime Core Web Vitals.</p>
    <div class="envline">
      <span>Node <code>${after.env.node}</code></span>
      <span>OS <code>${after.env.os}</code></span>
      <span>Vercel adapter <code>${before.env.adapterVercel} → ${after.env.adapterVercel}</code></span>
      <span>Node adapter <code>${before.env.adapterNode} → ${after.env.adapterNode}</code></span>
      <span>Generated <code>${generatedAt}</code></span>
    </div>
    <div class="note">
      <strong>Method.</strong> ${before.config.BUILD_RUNS} cold production builds (node adapter, caches cleared each run); the
      <em>fastest</em> run is the headline (least host contention), median shown alongside.
      Runtime metrics via Lighthouse ${after.runtime.lighthouseVersion} (<code>${after.runtime.preset}</code> preset, simulated throttling —
      robust to host CPU load), ${before.config.LH_RUNS} runs per page against a local <code>node dist/server/entry.mjs</code>, median per metric.
      Both runs measured back-to-back on the same machine. Lower is better for every metric except performance score.${
        afterPrerelease
          ? ` <strong>Note:</strong> Astro ${after.env.astro} is a pre-release.`
          : ""
      }
    </div>
  </header>

  <h2>Headline</h2>
  <div class="tiles">${summary.join("")}</div>

  <h2>Build</h2>
  <div class="panel">
    <table class="metrics">
      <thead><tr><th>Build</th><th>Before</th><th>After</th><th>Δ</th></tr></thead>
      <tbody>
        ${buildRunsRows}
        <tr class="total-row"><td class="metric"><strong>Median</strong></td><td class="num">${fmtS(before.build.medianMs)}</td><td class="num">${fmtS(after.build.medianMs)}</td><td class="num"><span class="badge ${buildDeltaMedian.cls}">${buildDeltaMedian.html}</span></td></tr>
        <tr><td class="metric"><strong>Fastest</strong></td><td class="num">${fmtS(before.build.minMs)}</td><td class="num">${fmtS(after.build.minMs)}</td><td class="num"><span class="badge ${buildDeltaFastest.cls}">${buildDeltaFastest.html}</span></td></tr>
      </tbody>
    </table>
  </div>

  <h2>Build output size</h2>
  <div class="panel">
    <table class="metrics">
      <thead><tr><th>Artifact</th><th>Before</th><th>After</th><th>Δ</th></tr></thead>
      <tbody>${sizeRows()}</tbody>
    </table>
  </div>

  <h2>Runtime · Core Web Vitals &amp; performance metrics</h2>
  ${pageSections}

  <footer>
    Each metric is the median of ${before.config.LH_RUNS} Lighthouse passes. Vercel Analytics &amp; Speed Insights
    scripts are present in both builds (their endpoints 404 when served locally), so they affect both runs identically.
    Generated by <code>bench/report.mjs</code>.
  </footer>
</div>
</body>
</html>`;

const out = path.join(import.meta.dirname, "benchmark-report.html");
fs.writeFileSync(out, html);
console.log(`wrote ${out}`);
