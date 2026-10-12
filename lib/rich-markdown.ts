import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Marked, type Token, type Tokens } from "marked";

interface LinkPreview {
  description?: string;
  image?: string;
  kind: "link" | "profile" | "tweet";
  profileUrl?: string;
  site: string;
  title: string;
  tweetHtml?: string;
}

interface OEmbedResponse {
  author_name?: string;
  author_url?: string;
  html?: string;
}

const EXTERNAL_URL_REGEX = /^https?:\/\//;
const TITLE_TAG_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const TWEET_BODY_REGEX = /<p[^>]*>([\s\S]*?)<\/p>/i;
const WWW_PREFIX_REGEX = /^www\./;
const BR_TAG_REGEX = /<br\s*\/?>/gi;
const PROFILE_IMAGE_URL_REGEX =
  /https:\/\/pbs\.twimg\.com\/profile_images\/[^"\\]+/i;
const AVATAR_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const AVATAR_CACHE_DIRECTORY = join(
  process.cwd(),
  ".astro",
  "blog-avatar-cache"
);

const PROFILE_NAMES: Record<string, string> = {
  burnedchris: "Christopher Burns",
  kaylee_dev: "Kaylee Williams",
  tannerlinsley: "Tanner Linsley",
};
const previewCache = new Map<string, Promise<LinkPreview>>();
const avatarCache = new Map<string, Promise<string | undefined>>();

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&apos;": "'",
  "&#39;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(amp|apos|#39|gt|lt|quot);/g,
    (entity) => ENTITY_MAP[entity] ?? entity
  );
}

function plainText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, "").trim());
}

export function normalizeXProfileTitle(
  title: string | undefined,
  handle: string
): string | undefined {
  if (!title) {
    return;
  }
  const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = new RegExp(`\\s+\\(@${escapedHandle}\\)\\s+on X$`, "i");
  return title.replace(suffix, "").trim() || undefined;
}

function metaContent(html: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (match) {
      return plainText(match);
    }
  }
  return;
}

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": "kaylee.dev link preview" },
    signal: AbortSignal.timeout(3500),
  });
}

async function responseDataUrl(
  response: Response
): Promise<string | undefined> {
  if (!response.ok) {
    return;
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return;
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 200_000) {
    return;
  }
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function avatarCachePath(handle: string): string {
  const safeHandle = handle.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return join(AVATAR_CACHE_DIRECTORY, `${safeHandle}.txt`);
}

async function readCachedAvatar(handle: string): Promise<string | undefined> {
  try {
    const path = avatarCachePath(handle);
    const file = await stat(path);
    if (Date.now() - file.mtimeMs > AVATAR_CACHE_MAX_AGE_MS) {
      return;
    }
    return await readFile(path, "utf8");
  } catch {
    return;
  }
}

async function fetchAvatar(handle: string): Promise<string | undefined> {
  const cached = await readCachedAvatar(handle);
  if (cached) {
    return cached;
  }

  let image: string | undefined;
  try {
    const response = await fetchWithTimeout(
      `https://unavatar.io/x/${encodeURIComponent(handle)}?fallback=false`
    );
    image = await responseDataUrl(response);
  } catch {
    image = undefined;
  }

  if (!image) {
    try {
      const profileResponse = await fetchWithTimeout(`https://x.com/${handle}`);
      const profileHtml = profileResponse.ok
        ? await profileResponse.text()
        : "";
      const imageUrl = profileHtml.match(PROFILE_IMAGE_URL_REGEX)?.[0];
      if (imageUrl) {
        image = await responseDataUrl(await fetchWithTimeout(imageUrl));
      }
    } catch {
      image = undefined;
    }
  }

  if (image) {
    try {
      await mkdir(AVATAR_CACHE_DIRECTORY, { recursive: true });
      await writeFile(avatarCachePath(handle), image, "utf8");
    } catch {
      // A read-only build filesystem still gets the in-memory cached image.
    }
  }
  return image;
}

function avatarDataUrl(handle: string): Promise<string | undefined> {
  const key = handle.toLowerCase();
  const cached = avatarCache.get(key);
  if (cached) {
    return cached;
  }
  const avatar = fetchAvatar(key);
  avatarCache.set(key, avatar);
  return avatar;
}

function parseXUrl(
  url: URL
):
  | { handle: string; kind: "profile" }
  | { handle: string; id: string; kind: "tweet" }
  | undefined {
  if (
    !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
      url.hostname
    )
  ) {
    return;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 1) {
    return { handle: parts[0], kind: "profile" };
  }
  if (parts.length >= 3 && parts[1] === "status") {
    return { handle: parts[0], id: parts[2], kind: "tweet" };
  }
  return;
}

async function profilePreview(
  handle: string,
  linkLabel: string
): Promise<LinkPreview> {
  const explicitLabel = linkLabel.startsWith("http") ? undefined : linkLabel;
  const image = avatarDataUrl(handle);
  let resolvedName: string | undefined;
  if (!explicitLabel) {
    try {
      const response = await fetchWithTimeout(`https://x.com/${handle}`);
      const html = response.ok ? await response.text() : "";
      resolvedName = normalizeXProfileTitle(
        metaContent(html, "og:title"),
        handle
      );
    } catch {
      resolvedName = undefined;
    }
  }
  return {
    image: await image,
    kind: "profile",
    profileUrl: `https://x.com/${handle}`,
    site: `@${handle}`,
    title:
      explicitLabel ||
      resolvedName ||
      PROFILE_NAMES[handle.toLowerCase()] ||
      `@${handle}`,
  };
}

async function tweetPreview(url: string, handle: string): Promise<LinkPreview> {
  try {
    const endpoint = new URL("https://publish.twitter.com/oembed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("dnt", "true");
    endpoint.searchParams.set("omit_script", "true");
    const response = await fetchWithTimeout(endpoint.toString());
    if (!response.ok) {
      throw new Error("X did not return this post");
    }
    const data = (await response.json()) as OEmbedResponse;
    const tweetHtml = data.html?.match(TWEET_BODY_REGEX)?.[1];
    const resolvedHandle =
      data.author_url?.split("/").filter(Boolean).at(-1) || handle;
    return {
      image: await avatarDataUrl(resolvedHandle),
      kind: "tweet",
      profileUrl: data.author_url || `https://x.com/${resolvedHandle}`,
      site: `@${resolvedHandle}`,
      title:
        data.author_name ||
        PROFILE_NAMES[resolvedHandle] ||
        `@${resolvedHandle}`,
      tweetHtml,
    };
  } catch {
    return {
      image: await avatarDataUrl(handle),
      kind: "tweet",
      profileUrl: `https://x.com/${handle}`,
      site: `@${handle}`,
      title: PROFILE_NAMES[handle.toLowerCase()] || `@${handle}`,
    };
  }
}

async function websitePreview(
  url: URL,
  linkLabel: string
): Promise<LinkPreview> {
  const fallbackTitle = linkLabel.startsWith("http")
    ? url.hostname.replace(WWW_PREFIX_REGEX, "")
    : linkLabel;
  try {
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) {
      throw new Error("Preview request failed");
    }
    const html = await response.text();
    const rawTitle =
      metaContent(html, "og:title") ||
      plainText(html.match(TITLE_TAG_REGEX)?.[1] ?? "");
    return {
      description:
        metaContent(html, "og:description") || metaContent(html, "description"),
      kind: "link",
      site:
        metaContent(html, "og:site_name") ||
        url.hostname.replace(WWW_PREFIX_REGEX, ""),
      title: rawTitle || fallbackTitle,
    };
  } catch {
    return {
      kind: "link",
      site: url.hostname.replace(WWW_PREFIX_REGEX, ""),
      title: fallbackTitle,
    };
  }
}

function createPreview(href: string, label: string): Promise<LinkPreview> {
  const url = new URL(href);
  const xLink = parseXUrl(url);
  if (xLink?.kind === "profile") {
    return profilePreview(xLink.handle, label);
  }
  if (xLink?.kind === "tweet") {
    return tweetPreview(url.toString(), xLink.handle);
  }
  return websitePreview(url, label);
}

function cachedPreview(href: string, label: string): Promise<LinkPreview> {
  const cached = previewCache.get(href);
  if (cached) {
    return cached;
  }
  const preview = createPreview(href, label).catch((error: unknown) => {
    previewCache.delete(href);
    throw error;
  });
  previewCache.set(href, preview);
  return preview;
}

function standaloneLink(token: Tokens.Paragraph): Tokens.Link | undefined {
  if (token.tokens.length !== 1 || token.tokens[0].type !== "link") {
    return;
  }
  const link = token.tokens[0] as Tokens.Link;
  return EXTERNAL_URL_REGEX.test(link.href) ? link : undefined;
}

function avatarMarkup(preview: LinkPreview): string {
  if (preview.image) {
    return `<img class="rich-embed__avatar" src="${escapeHtml(preview.image)}" alt="" width="44" height="44" />`;
  }
  return `<span class="rich-embed__avatar rich-embed__avatar--fallback" aria-hidden="true">${escapeHtml(preview.title.charAt(0))}</span>`;
}

function inlineAvatarMarkup(preview: LinkPreview): string {
  if (preview.image) {
    return `<img class="inline-profile__avatar" src="${escapeHtml(preview.image)}" alt="" width="20" height="20" />`;
  }
  return `<span aria-hidden="true">${escapeHtml(preview.title.charAt(0))}</span>`;
}

function renderInlineProfile(href: string, preview: LinkPreview): string {
  return `<a class="inline-profile" href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${inlineAvatarMarkup(preview)}<strong>${escapeHtml(preview.title)}</strong></a>`;
}

function renderPreview(href: string, preview: LinkPreview): string {
  const safeHref = escapeHtml(href);
  if (preview.kind === "profile") {
    return `<a class="rich-profile" href="${safeHref}" rel="noopener noreferrer" target="_blank">${avatarMarkup(preview)}<span><strong>${escapeHtml(preview.title)}</strong><small>${escapeHtml(preview.site)}</small></span><span class="rich-embed__mark" aria-hidden="true">𝕏</span></a>`;
  }
  if (preview.kind === "tweet") {
    const body = preview.tweetHtml
      ? `<div class="rich-tweet__body">${preview.tweetHtml}</div>`
      : '<p class="rich-tweet__fallback">View this post on X.</p>';
    const profileUrl = escapeHtml(preview.profileUrl || href);
    return `<article class="rich-tweet"><header><a class="rich-tweet__author" href="${profileUrl}" rel="noopener noreferrer" target="_blank">${avatarMarkup(preview)}<span><strong>${escapeHtml(preview.title)}</strong><small>${escapeHtml(preview.site)}</small></span></a><span class="rich-embed__mark" aria-hidden="true">𝕏</span></header>${body}<a class="rich-tweet__source" href="${safeHref}" rel="noopener noreferrer" target="_blank">View on X <span aria-hidden="true">↗</span></a></article>`;
  }
  return `<a class="rich-link" href="${safeHref}" rel="noopener noreferrer" target="_blank"><span class="rich-link__site">${escapeHtml(preview.site)}</span><strong>${escapeHtml(preview.title)}</strong>${preview.description ? `<span class="rich-link__description">${escapeHtml(preview.description)}</span>` : ""}<span class="rich-link__action">Visit site <span aria-hidden="true">↗</span></span></a>`;
}

function agentProfileLink(href: string, preview: LinkPreview): string {
  const identity =
    preview.title === preview.site
      ? preview.title
      : `${preview.title} (${preview.site})`;
  return `[${identity}](${href})`;
}

function agentTweetQuote(href: string, preview: LinkPreview): string {
  const text = preview.tweetHtml
    ? plainText(preview.tweetHtml.replace(BR_TAG_REGEX, "\n"))
    : "Post text unavailable. View the original on X.";
  const quote = text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `${quote}\n>\n> ${agentProfileLink(href, preview)}`;
}

function linksInToken(parser: Marked, token: Token): Tokens.Link[] {
  const links: Tokens.Link[] = [];
  parser.walkTokens([token], (child) => {
    if (child.type === "link") {
      links.push(child);
    }
  });
  return links;
}

function replaceAgentLinks(
  raw: string,
  links: Tokens.Link[],
  previews: Map<string, LinkPreview>
): { markdown: string; tweetQuotes: string[] } {
  let cursor = 0;
  let markdown = "";
  const tweetQuotes: string[] = [];

  for (const link of links) {
    const preview = previews.get(link.href);
    if (!(preview && ["profile", "tweet"].includes(preview.kind))) {
      continue;
    }
    const index = raw.indexOf(link.raw, cursor);
    if (index < 0) {
      continue;
    }
    markdown += raw.slice(cursor, index);
    if (preview.kind === "profile") {
      markdown += agentProfileLink(link.href, preview);
    } else {
      markdown += `[X post by ${preview.title} (${preview.site})](${link.href})`;
      tweetQuotes.push(agentTweetQuote(link.href, preview));
    }
    cursor = index + link.raw.length;
  }

  markdown += raw.slice(cursor);
  return { markdown, tweetQuotes };
}

export async function renderAgentMarkdown(source: string): Promise<string> {
  const parser = new Marked({ gfm: true });
  const tokens = parser.lexer(source);
  const xLinks: Tokens.Link[] = [];
  parser.walkTokens(tokens, (token) => {
    if (token.type !== "link" || !EXTERNAL_URL_REGEX.test(token.href)) {
      return;
    }
    try {
      if (parseXUrl(new URL(token.href))) {
        xLinks.push(token);
      }
    } catch {
      // Malformed links remain unchanged in the Markdown mirror.
    }
  });

  const previews = new Map<string, LinkPreview>();
  await Promise.all(
    xLinks.map(async (link) => {
      try {
        previews.set(link.href, await cachedPreview(link.href, link.text));
      } catch {
        // Preserve the author's original Markdown when metadata is unavailable.
      }
    })
  );

  const rendered = tokens.map((token) => {
    if (token.type === "code" || token.type === "html") {
      return token.raw;
    }
    if (token.type === "paragraph") {
      const standalone = standaloneLink(token);
      const preview = standalone ? previews.get(standalone.href) : undefined;
      if (standalone && preview?.kind === "tweet") {
        return `${agentTweetQuote(standalone.href, preview)}\n\n`;
      }
      if (standalone && preview?.kind === "profile") {
        return `${agentProfileLink(standalone.href, preview)}\n\n`;
      }
    }

    const { markdown, tweetQuotes } = replaceAgentLinks(
      token.raw,
      linksInToken(parser, token),
      previews
    );
    if (tweetQuotes.length === 0) {
      return markdown;
    }
    return `${markdown.trimEnd()}\n\n${tweetQuotes.join("\n\n")}\n\n`;
  });

  return rendered.join("").trimEnd();
}

export async function renderRichMarkdown(source: string): Promise<string> {
  const parser = new Marked({ gfm: true });
  const tokens = parser.lexer(source);
  const standaloneLinks = tokens
    .filter((token): token is Tokens.Paragraph => token.type === "paragraph")
    .map(standaloneLink)
    .filter((link): link is Tokens.Link => Boolean(link));
  const inlineProfileLinks: Tokens.Link[] = [];
  parser.walkTokens(tokens, (token) => {
    if (token.type !== "link" || !EXTERNAL_URL_REGEX.test(token.href)) {
      return;
    }
    try {
      if (parseXUrl(new URL(token.href))?.kind === "profile") {
        inlineProfileLinks.push(token);
      }
    } catch {
      // Malformed links retain Marked's normal link rendering.
    }
  });
  const links = [...standaloneLinks, ...inlineProfileLinks].filter(
    (link, index, allLinks) =>
      allLinks.findIndex((candidate) => candidate.href === link.href) === index
  );
  const previews = new Map<string, LinkPreview>();

  await Promise.all(
    links.map(async (link) => {
      try {
        previews.set(link.href, await cachedPreview(link.href, link.text));
      } catch {
        // The normal Markdown link remains the fallback for malformed URLs.
      }
    })
  );

  parser.use({
    renderer: {
      link({ href, title, tokens: linkTokens }) {
        const preview = previews.get(href);
        if (preview?.kind === "profile") {
          return renderInlineProfile(href, preview);
        }
        const text = this.parser.parseInline(linkTokens);
        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
        const external = EXTERNAL_URL_REGEX.test(href);
        return `<a href="${escapeHtml(href)}"${titleAttribute}${external ? ' rel="noopener noreferrer" target="_blank"' : ""}>${text}</a>`;
      },
      paragraph(token) {
        const link = standaloneLink(token);
        const preview = link ? previews.get(link.href) : undefined;
        if (link && preview) {
          return `${renderPreview(link.href, preview)}\n`;
        }
        return `<p>${this.parser.parseInline(token.tokens)}</p>\n`;
      },
    },
  });

  return parser.parser(tokens) as string;
}
