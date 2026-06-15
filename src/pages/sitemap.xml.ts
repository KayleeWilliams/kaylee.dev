const BASE_URL = "https://www.kaylee.dev";

export function GET(): Response {
  const now = new Date().toISOString();
  const routes = [
    { path: "", priority: "1" },
    { path: "/about", priority: "0.8" },
    { path: "/projects", priority: "0.8" },
    { path: "/connect", priority: "0.5" },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map(
      ({ path, priority }) =>
        `  <url><loc>${BASE_URL}${path}</loc><lastmod>${now}</lastmod><priority>${priority}</priority></url>`
    )
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
