import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const adapter =
  process.env.ASTRO_ADAPTER === "node"
    ? node({ mode: "standalone" })
    : vercel();

export default defineConfig({
  output: "server",
  adapter,
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
