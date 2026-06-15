// Experience detail pages were retired; their content now lives on /about.
// Permanently redirect any old /experience/* URL (everfund, inth, consent) so
// existing links and search-engine entries do not 404.
export function GET(): Response {
  return new Response(null, {
    status: 301,
    headers: { Location: "/about" },
  });
}
