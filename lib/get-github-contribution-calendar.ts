import { withMemoryCache } from "./cache";

type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface GitHubContributionDay {
  count: number;
  date: string;
  level: ContributionLevel;
}

export interface GitHubContributionCalendar {
  activeDays: number;
  days: GitHubContributionDay[];
  rangeDays: number;
  total: number;
}

const CACHE_TTL = 6 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const CONTRIBUTION_COUNT_PATTERN = /^([\d,]+) contribution/;
const DAY_ATTRIBUTE_PATTERN =
  /<td\b[^>]*class="ContributionCalendar-day"[^>]*>/g;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function parseTooltipCount(html: string, id: string): number {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tooltip = html.match(
    new RegExp(`<tool-tip[^>]*for="${escapedId}"[^>]*>([^<]*)<\\/tool-tip>`)
  );
  const text = tooltip?.[1] ?? "";
  if (text.startsWith("No contributions")) {
    return 0;
  }

  const count = text.match(CONTRIBUTION_COUNT_PATTERN);
  return count ? Number.parseInt(count[1].replace(/,/g, ""), 10) : 0;
}

function parseContributionDays(html: string): GitHubContributionDay[] {
  const days: GitHubContributionDay[] = [];

  for (const match of html.matchAll(DAY_ATTRIBUTE_PATTERN)) {
    const attributes = parseAttributes(match[0]);
    const date = attributes["data-date"];
    const id = attributes.id;
    const level = Number.parseInt(attributes["data-level"] ?? "0", 10);

    if (!(date && id) || Number.isNaN(level)) {
      continue;
    }

    days.push({
      date,
      count: parseTooltipCount(html, id),
      level: Math.max(0, Math.min(level, 4)) as ContributionLevel,
    });
  }

  return days;
}

function normalizeCalendar(
  parsedDays: GitHubContributionDay[],
  endDate: Date,
  rangeDays: number
): GitHubContributionCalendar {
  const countByDate = new Map(parsedDays.map((day) => [day.date, day]));
  const firstDate = addDays(endDate, -(rangeDays - 1));
  const days: GitHubContributionDay[] = [];

  for (let index = 0; index < rangeDays; index++) {
    const date = formatDateKey(addDays(firstDate, index));
    days.push(countByDate.get(date) ?? { date, count: 0, level: 0 });
  }

  return {
    days,
    rangeDays,
    total: days.reduce((sum, day) => sum + day.count, 0),
    activeDays: days.filter((day) => day.count > 0).length,
  };
}

async function fetchContributionYear(
  username: string,
  year: number
): Promise<GitHubContributionDay[] | null> {
  const response = await fetch(
    `https://github.com/users/${username}/contributions?from=${year}-01-01&to=${year}-12-31`,
    {
      headers: {
        Accept: "text/html",
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const days = parseContributionDays(await response.text());
  return days.length > 0 ? days : null;
}

export async function getGitHubContributionCalendar(
  username: string,
  rangeDays = 180
): Promise<GitHubContributionCalendar | null> {
  const today = startOfUtcDay(new Date());
  const firstDate = addDays(today, -(rangeDays - 1));
  const year = today.getUTCFullYear();

  return await withMemoryCache(
    `github-contribution-calendar:${username}:${year}:${rangeDays}`,
    CACHE_TTL,
    async () => {
      try {
        const years = Array.from(
          { length: year - firstDate.getUTCFullYear() + 1 },
          (_, index) => firstDate.getUTCFullYear() + index
        );
        const calendarYears = await Promise.all(
          years.map((calendarYear) =>
            fetchContributionYear(username, calendarYear)
          )
        );

        if (calendarYears.some((days) => days == null)) {
          return null;
        }

        const parsedDays = (calendarYears as GitHubContributionDay[][])
          .flat()
          .filter((day) => {
            const timestamp = new Date(`${day.date}T00:00:00Z`).getTime();
            return (
              timestamp >= firstDate.getTime() && timestamp <= today.getTime()
            );
          });

        if (parsedDays.length === 0) {
          return null;
        }

        return normalizeCalendar(parsedDays, today, rangeDays);
      } catch {
        return null;
      }
    }
  );
}
