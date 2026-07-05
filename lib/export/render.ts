import { ExportFormat } from "@prisma/client";
import { z } from "zod";

export const exportInputSchema = z.object({
  title: z.string().min(1),
  body_markdown: z.string().min(1),
  disclosure_text: z.string().nullable().optional(),
  price_notice: z.string().nullable().optional(),
});

export type ExportInput = z.infer<typeof exportInputSchema>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMarkdownExport(input: ExportInput): string {
  const parts = [
    `# ${input.title}`,
    input.disclosure_text ?? "",
    input.body_markdown,
    input.price_notice ?? "",
  ].filter((part) => part.trim().length > 0);
  return parts.join("\n\n");
}

export function renderNaverHtmlExport(input: ExportInput): string {
  const markdown = renderMarkdownExport(input);
  const html = markdown
    .split(/\n{2,}/)
    .map((paragraph) => {
      if (paragraph.startsWith("# ")) {
        return `<h1>${escapeHtml(paragraph.slice(2))}</h1>`;
      }
      return `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");

  return `<article class="paperclip-export">\n${html}\n</article>`;
}

export function createExportBundle(input: ExportInput): readonly {
  readonly format: ExportFormat;
  readonly content: string;
}[] {
  const markdown = renderMarkdownExport(input);
  const html = renderNaverHtmlExport(input);
  return [
    { format: ExportFormat.markdown, content: markdown },
    { format: ExportFormat.html, content: html },
    { format: ExportFormat.copy, content: markdown },
    {
      format: ExportFormat.zip,
      content: JSON.stringify({
        files: [
          { name: "post.md", content: markdown },
          { name: "post.html", content: html },
        ],
      }),
    },
  ];
}
