export function GET(): Response {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Sitemap: https://www.kaylee.dev/sitemap.xml",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}
