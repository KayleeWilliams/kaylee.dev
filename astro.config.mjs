import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const adapter =
  process.env.ASTRO_ADAPTER === "node"
    ? node({ mode: "standalone" })
    : vercel();

export default defineConfig({
  site: "https://www.kaylee.dev",
  output: "server",
  adapter,
  // Svelte powers only the /records crate island; the rest of the site stays
  // framework-free static Astro.
  integrations: [svelte()],
  // /connect is the canonical page; /contact is a permanent alias so anyone
  // who types the more-common word still lands in the right place.
  redirects: {
    "/contact": { status: 301, destination: "/connect" },
  },
  build: {
    // Keep CSS cacheable and avoid inflating every HTML response.
    inlineStylesheets: "never",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
