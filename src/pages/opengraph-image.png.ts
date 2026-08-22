import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

export const prerender = true;

// Social scrapers (X, Facebook, LinkedIn, Slack, iMessage) don't render SVG
// og:images, so the card is rasterized to PNG at build time. Nunito TTFs are
// vendored because resvg has no system fonts at build.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5f3ff"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f5f3ff"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(139, 92, 246, 0.1)"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <text x="600" y="280" text-anchor="middle" font-family="Nunito" font-size="72" font-weight="700" fill="#171717">Kaylee Williams</text>
  <text x="600" y="340" text-anchor="middle" font-family="Nunito" font-size="36" fill="#8b5cf6">Founding engineer</text>
  <text x="600" y="394" text-anchor="middle" font-family="Nunito" font-size="24" fill="#6b7280">Inth (YC P26) · co-author of c15t</text>
  <text x="600" y="570" text-anchor="middle" font-family="Nunito" font-size="20" fill="#9ca3af">kaylee.dev</text>
</svg>`;

export function GET(): Response {
  const fontDir = resolve(process.cwd(), "src/assets/fonts");
  const png = new Resvg(svg, {
    font: {
      fontFiles: [
        resolve(fontDir, "nunito-400.ttf"),
        resolve(fontDir, "nunito-700.ttf"),
      ],
      defaultFontFamily: "Nunito",
      loadSystemFonts: false,
    },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
