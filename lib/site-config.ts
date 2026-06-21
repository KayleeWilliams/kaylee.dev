import person from "@/content/site/person.json";
import socials from "@/content/site/socials.json";

export type PersonConfig = typeof person;
export type SocialConfig = (typeof socials)[number];

export interface Appearance {
  date?: string;
  event: string;
  eventUrl?: string;
  title: string;
  type?: "talk" | "judge";
  url?: string;
}

export const personConfig: PersonConfig = person;
export const socialConfig: SocialConfig[] = socials;
