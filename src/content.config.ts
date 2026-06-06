import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const site = defineCollection({
  loader: glob({ base: "./content/site", pattern: "*.md" }),
  schema: z.object({
    currentWork: z.array(z.string()).optional(),
    description: z.string().optional(),
    docsUrl: z.string().url().optional(),
    github: z.string().url().optional(),
    npmPackage: z.string().optional(),
    projectUrl: z.string().url().optional(),
    statsUrl: z.string().url().optional(),
    title: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./content/projects", pattern: "*.md" }),
  schema: z.object({
    active: z.boolean().optional(),
    date: z.string(),
    demo: z.string().url().optional(),
    description: z.string(),
    featured: z.boolean().optional(),
    github: z.string().url().optional(),
    image: z.string(),
    showStars: z.boolean().optional(),
    tags: z.array(z.string()),
    title: z.string(),
    url: z.string().url().optional(),
  }),
});

const experience = defineCollection({
  loader: glob({ base: "./content/experience", pattern: "*.md" }),
  schema: z.object({
    company: z.string(),
    description: z.string(),
    disableDetails: z.boolean().optional(),
    endDate: z.string().optional(),
    logo: z.string(),
    logoDark: z.string().optional(),
    role: z.string(),
    startDate: z.string(),
    tech: z.array(z.string()),
    url: z.string().url().optional(),
  }),
});

export const collections = { experience, projects, site };
