export interface ExperienceFrontmatter {
  company: string;
  date?: string;
  description: string;
  disableDetails?: boolean;
  endDate?: string;
  logo: string;
  logoDark?: string;
  role: string;
  startDate: string;
  tech: string[];
  url?: string;
}

export interface Experience extends ExperienceFrontmatter {
  content: string;
  slug: string;
}
