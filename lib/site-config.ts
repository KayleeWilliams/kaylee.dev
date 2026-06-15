import person from "@/content/site/person.json";
import socials from "@/content/site/socials.json";

export type PersonConfig = typeof person;
export type SocialConfig = (typeof socials)[number];

export type Appearance = {
  type?: "talk" | "judge";
  title: string;
  event: string;
  date?: string;
  url?: string;
  eventUrl?: string;
};

export const personConfig: PersonConfig = person;
export const socialConfig: SocialConfig[] = socials;
