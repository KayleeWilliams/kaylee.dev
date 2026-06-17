export interface ProjectFrontmatter {
  active?: boolean;
  date: string;
  demo?: string;
  description: string;
  featured?: boolean;
  github?: string;
  image?: string;

  /**
   * Display the number of stars for the repository
   * @default false
   */
  showStars?: boolean;

  /**
   * Stars count for the repository
   * @remarks
   * This is dynamically fetched from the repository if showStars is true
   */
  stars?: number;
  tags: string[];
  title: string;

  /**
   * URL for the project
   * @default undefined
   */
  url?: string;
}

export interface Project extends ProjectFrontmatter {
  content: string;
  slug: string;
}
