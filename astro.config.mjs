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
  build: {
    // Keep CSS cacheable and avoid inflating every HTML response.
    inlineStylesheets: "never",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
