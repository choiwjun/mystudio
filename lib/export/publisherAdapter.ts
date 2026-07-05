import type { ExportFormat } from "@prisma/client";
import { createExportBundle, type ExportInput, exportInputSchema } from "@/lib/export/render";

export type ExportBundleRecord = {
  readonly format: ExportFormat;
  readonly content: string;
};

export type PublisherAdapter = {
  readonly channel: "naver";
  createBundle(input: ExportInput): readonly ExportBundleRecord[];
};

export class NaverExportAdapter implements PublisherAdapter {
  readonly channel = "naver";

  createBundle(input: ExportInput): readonly ExportBundleRecord[] {
    return createExportBundle(exportInputSchema.parse(input));
  }
}
