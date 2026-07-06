import { ExportFormat } from "@prisma/client";
import { z } from "zod";

export const exportInputSchema = z.object({
  title: z.string().min(1),
  body_markdown: z.string().min(1),
  disclosure_text: z.string().nullable().optional(),
  price_notice: z.string().nullable().optional(),
});

export type ExportInput = z.infer<typeof exportInputSchema>;
export type ExportManifest = {
  readonly content_package_id: string | null;
  readonly draft_id: string | null;
  readonly compliance_check_id: string | null;
  readonly generated_at: string;
  readonly formats: readonly string[];
  readonly publish_mode: "manual";
  readonly auto_publish: false;
  readonly manual_publish_required: true;
};

export type ExportBundleMetadata = {
  readonly content_package_id: string;
  readonly draft_id: string;
  readonly compliance_check_id: string;
  readonly generated_at: string;
};

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

  return `<article class="paperclip-export" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.7; color: #111827;">\n${html}\n</article>`;
}

const zipCrc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (zipCrc32Table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipFile = {
  readonly name: string;
  readonly content: string;
};

function createStoredZipBase64(files: readonly ZipFile[]): string {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const dataBuffer = Buffer.from(file.content, "utf8");
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuffer, dataBuffer);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]).toString("base64");
}

export function createExportManifest(metadata?: ExportBundleMetadata): ExportManifest {
  return {
    content_package_id: metadata?.content_package_id ?? null,
    draft_id: metadata?.draft_id ?? null,
    compliance_check_id: metadata?.compliance_check_id ?? null,
    generated_at: metadata?.generated_at ?? new Date(0).toISOString(),
    formats: ["markdown", "html", "copy", "zip"],
    publish_mode: "manual",
    auto_publish: false,
    manual_publish_required: true,
  };
}

export function createExportBundle(
  input: ExportInput,
  metadata?: ExportBundleMetadata,
): readonly {
  readonly format: ExportFormat;
  readonly content: string;
}[] {
  const markdown = renderMarkdownExport(input);
  const html = renderNaverHtmlExport(input);
  const plainText = markdown;
  const manifest = createExportManifest(metadata);
  const manifestJson = JSON.stringify(manifest, null, 2);
  return [
    { format: ExportFormat.markdown, content: markdown },
    { format: ExportFormat.html, content: html },
    { format: ExportFormat.copy, content: plainText },
    {
      format: ExportFormat.zip,
      content: createStoredZipBase64([
        { name: "post.md", content: markdown },
        { name: "post.html", content: html },
        { name: "post.txt", content: plainText },
        { name: "export_manifest.json", content: manifestJson },
      ]),
    },
  ];
}
