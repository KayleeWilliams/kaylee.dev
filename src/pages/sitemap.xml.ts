import { getAllExperience } from "@/lib/get-all-experience";

export async function GET(): Promise<Response> {
  const experiences = await getAllExperience();
  const urls = [
    "https://www.kaylee.dev",
    ...experiences
      .filter((experience) => !experience.disableDetails)
      .map(
        (experience) => `https://www.kaylee.dev/experience/${experience.slug}`
      ),
  ];
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url) =>
        `  <url><loc>${url}</loc><lastmod>${now}</lastmod>${url === "https://www.kaylee.dev" ? "<priority>1</priority>" : ""}</url>`
    )
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
