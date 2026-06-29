// Reusable benchmark harness. Runs against whatever version of the app is
// currently installed and writes bench/results/<label>.json.
//
//   node bench/bench.mjs <label>
//
// Measures, identically before & after the Astro 7 upgrade:
//   * cold production build time (node adapter), N repeats -> min + median
//   * built output size (server bundle, client JS/CSS, file counts)
//   * Lighthouse runtime metrics per page, N repeats -> per-metric median
//     (performance score, Core Web Vitals, and every other perf metric LH emits)
//
// Chrome is driven headless against a locally served `node dist/server/entry.mjs`.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { launch } = require("chrome-launcher");
const lighthouse = require("lighthouse").default;
const desktopConfig =
  require("lighthouse/core/config/desktop-config.js").default;

const ROOT = path.resolve(import.meta.dirname, "..");
const RESULTS_DIR = path.join(import.meta.dirname, "results");

const label = process.argv[2];
if (!label) {
  console.error("usage: node bench/bench.mjs <label>");
  process.exit(1);
}

// --- tunables ---------------------------------------------------------------
const BUILD_RUNS = 5; // cold builds timed; min is the headline (least host contention)
const LH_RUNS = 3; // lighthouse passes per page (median taken)
const PORT = 4399;
const HOST = "127.0.0.1";
const PAGES = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Projects", path: "/projects" },
  { name: "Connect", path: "/connect" },
];

// --- helpers ----------------------------------------------------------------
const log = (...a) => console.log(`[bench:${label}]`, ...a);

function pkgVersion(name) {
  try {
    return require(path.join(ROOT, "node_modules", name, "package.json"))
      .version;
  } catch {
    return null;
  }
}

function rmrf(...rels) {
  for (const rel of rels) {
    fs.rmSync(path.join(ROOT, rel), { recursive: true, force: true });
  }
}

function dirStats(dir) {
  // Returns { total, byExt: {ext: bytes}, files }
  const out = { total: 0, byExt: {}, files: 0 };
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = dirStats(full);
      out.total += sub.total;
      out.files += sub.files;
      for (const [ext, n] of Object.entries(sub.byExt)) {
        out.byExt[ext] = (out.byExt[ext] || 0) + n;
      }
    } else if (entry.isFile()) {
      const size = fs.statSync(full).size;
      const ext = path.extname(entry.name).toLowerCase() || "(none)";
      out.total += size;
      out.files += 1;
      out.byExt[ext] = (out.byExt[ext] || 0) + size;
    }
  }
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// --- 1. build timing --------------------------------------------------------
function timeBuilds() {
  log(`timing ${BUILD_RUNS} cold builds (node adapter)…`);
  const times = [];
  for (let i = 0; i < BUILD_RUNS; i++) {
    rmrf("dist", ".astro", "node_modules/.vite", "node_modules/.astro");
    const t0 = performance.now();
    execFileSync("bun", ["run", "build:node"], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        ASTRO_ADAPTER: "node",
        ASTRO_TELEMETRY_DISABLED: "1",
      },
    });
    const ms = performance.now() - t0;
    times.push(ms);
    log(`  build ${i + 1}/${BUILD_RUNS}: ${(ms / 1000).toFixed(2)}s`);
  }
  return { runsMs: times, minMs: Math.min(...times), medianMs: median(times) };
}

// --- 2. output size ---------------------------------------------------------
function measureDist() {
  const distDir = path.join(ROOT, "dist");
  const server = dirStats(path.join(distDir, "server"));
  const client = dirStats(path.join(distDir, "client"));
  const all = dirStats(distDir);
  return {
    totalBytes: all.total,
    totalFiles: all.files,
    server: { totalBytes: server.total, files: server.files },
    client: {
      totalBytes: client.total,
      files: client.files,
      jsBytes: client.byExt[".js"] || 0,
      cssBytes: client.byExt[".css"] || 0,
    },
    byExt: all.byExt,
  };
}

// --- 3. serve + lighthouse --------------------------------------------------
async function waitForServer(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok) {
        return;
      }
    } catch {
      // server not accepting connections yet; retry after the delay below
    }
    await sleep(250);
  }
  throw new Error(`server did not become ready at ${url}`);
}

const M = (lhr, id) => lhr.audits[id]?.numericValue ?? null;

function extractMetrics(lhr) {
  return {
    performanceScore: Math.round((lhr.categories.performance.score ?? 0) * 100),
    fcp: M(lhr, "first-contentful-paint"),
    lcp: M(lhr, "largest-contentful-paint"),
    tbt: M(lhr, "total-blocking-time"),
    cls: M(lhr, "cumulative-layout-shift"),
    speedIndex: M(lhr, "speed-index"),
    tti: M(lhr, "interactive"),
    maxFid: M(lhr, "max-potential-fid"),
    ttfb: M(lhr, "server-response-time"),
    totalByteWeight: M(lhr, "total-byte-weight"),
    domSize: M(lhr, "dom-size"),
    mainThreadWork: M(lhr, "mainthread-work-breakdown"),
    bootupTime: M(lhr, "bootup-time"),
    requests: lhr.audits["network-requests"]?.details?.items?.length ?? null,
  };
}

function medianMetrics(runs) {
  const keys = Object.keys(runs[0]);
  const out = {};
  for (const k of keys) {
    const vals = runs.map((r) => r[k]).filter((v) => v != null);
    out[k] = vals.length ? median(vals) : null;
  }
  return out;
}

function freePort(port) {
  // Defensive: kill any process still bound to the bench port from a prior crash.
  try {
    const pids = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // process already exited between lsof and kill
      }
    }
  } catch {
    // lsof found nothing (or isn't available) — nothing to free
  }
}

async function runLighthouse() {
  freePort(PORT);
  log("starting node server…");
  const server = spawn("node", ["dist/server/entry.mjs"], {
    cwd: ROOT,
    env: { ...process.env, HOST, PORT: String(PORT) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let chrome;
  try {
    await waitForServer(`http://${HOST}:${PORT}/`);
    log("server ready; launching headless chrome…");
    chrome = await launch({
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
    });
    const lhVersion = require("lighthouse/package.json").version;

    const pages = [];
    for (const page of PAGES) {
      const url = `http://${HOST}:${PORT}${page.path}`;
      log(`lighthouse ${page.name} (${LH_RUNS} runs)…`);
      const runs = [];
      for (let i = 0; i < LH_RUNS; i++) {
        const result = await lighthouse(
          url,
          {
            port: chrome.port,
            output: "json",
            logLevel: "error",
            onlyCategories: ["performance"],
          },
          desktopConfig
        );
        runs.push(extractMetrics(result.lhr));
      }
      pages.push({ ...page, runs, metrics: medianMetrics(runs) });
      const m = pages.at(-1).metrics;
      log(
        `  ${page.name}: score=${m.performanceScore} LCP=${Math.round(m.lcp)}ms CLS=${m.cls.toFixed(3)}`
      );
    }
    return { lighthouseVersion: lhVersion, preset: "desktop", pages };
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        // chrome already gone
      }
    }
    server.kill("SIGKILL");
  }
}

// --- main -------------------------------------------------------------------
const env = {
  node: process.version,
  astro: pkgVersion("astro"),
  adapterNode: pkgVersion("@astrojs/node"),
  adapterVercel: pkgVersion("@astrojs/vercel"),
  tailwindVite: pkgVersion("@tailwindcss/vite"),
  os: `${process.platform} ${process.arch}`,
};
log("environment:", JSON.stringify(env));

const build = timeBuilds();
const dist = measureDist();
const runtime = await runLighthouse();

fs.mkdirSync(RESULTS_DIR, { recursive: true });
const result = {
  label,
  env,
  config: { BUILD_RUNS, LH_RUNS },
  build,
  dist,
  runtime,
};
const outPath = path.join(RESULTS_DIR, `${label}.json`);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
log(`wrote ${path.relative(ROOT, outPath)}`);
log(
  `build median: ${(build.medianMs / 1000).toFixed(2)}s | dist: ${(dist.totalBytes / 1024).toFixed(0)} KiB`
);
