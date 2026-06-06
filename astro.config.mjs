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
    // Inline all stylesheets into the HTML to avoid a render-blocking
    // chained CSS request (Lighthouse: "Avoid chaining critical requests").
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
