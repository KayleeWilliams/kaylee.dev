import { marked } from "marked";

marked.use({
  async: false,
  gfm: true,
});

export function renderMarkdown(content: string): string {
  return marked.parse(content, {
    async: false,
  }) as string;
}
