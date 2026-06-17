// Answer-engine and AI crawlers are explicitly welcomed (Kaylee's work is on
// agent-readable docs), in addition to the open default for everyone else.
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export function GET(): Response {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    ...AI_BOTS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
    "Sitemap: https://www.kaylee.dev/sitemap.xml",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
