export const prerender = true;

export function GET(): Response {
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
  <text x="600" y="280" text-anchor="middle" font-family="system-ui, sans-serif" font-size="72" font-weight="700" fill="#171717">Kaylee Williams</text>
  <text x="600" y="340" text-anchor="middle" font-family="system-ui, sans-serif" font-size="36" fill="#8b5cf6">Full-Stack Engineer</text>
  <text x="600" y="394" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="#6b7280">Building c15t &amp; Inth · YC P26</text>
  <text x="600" y="570" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#9ca3af">kaylee.dev</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
