import { createHash } from "node:crypto";
import { ExportFormat, PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { deriveComplianceCheckExportAllowed } from "@/lib/compliance/service";
import {
  transitionContentPackageStatus,
  updateContentPackageProgress,
} from "@/lib/content/repository";
import { prisma } from "@/lib/db";
import { createExportBundle, createExportManifest } from "@/lib/export/render";
import { recordCostLog } from "@/lib/logging/costLogger";

export const exportRequestSchema = z.object({}).strict();
const exportableStatuses: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.approved,
  PackageStatus.exported,
]);

function hasExportReadyStatus(status: PackageStatus): boolean {
  return exportableStatuses.has(status);
}

async function updateExportStatus(input: {
  readonly contentPackageId: string;
  readonly currentStatus: PackageStatus;
  readonly currentProgress: number | null;
}): Promise<void> {
  if (input.currentStatus === PackageStatus.approved) {
    await transitionContentPackageStatus({
      id: input.contentPackageId,
      fromStatus: input.currentStatus,
      toStatus: PackageStatus.exported,
      progress: 0.9,
      reason: "Export bundle generated",
    });
    return;
  }

  await updateContentPackageProgress({
    id: input.contentPackageId,
    progress: Math.max(input.currentProgress ?? 0, 0.9),
  });
}

function exportContentBuffer(format: ExportFormat, content: string): Buffer {
  return format === ExportFormat.zip
    ? Buffer.from(content, "base64")
    : Buffer.from(content, "utf8");
}

function checksumSha256(format: ExportFormat, content: string): string {
  return createHash("sha256").update(exportContentBuffer(format, content)).digest("hex");
}

function byteSizeForExport(format: ExportFormat, content: string): number {
  return exportContentBuffer(format, content).length;
}

function extensionForFormat(format: ExportFormat): string {
  switch (format) {
    case ExportFormat.markdown:
      return "md";
    case ExportFormat.html:
      return "html";
    case ExportFormat.copy:
      return "txt";
    case ExportFormat.zip:
      return "zip";
  }
}

export async function exportContentPackage(contentPackageId: string) {
  const contentPackage = await prisma.contentPackage.findUnique({
    where: { id: contentPackageId },
    include: {
      topic: true,
      drafts: { orderBy: { updatedAt: "desc" }, take: 1 },
      complianceChecks: {
        orderBy: { checkedAt: "desc" },
        take: 1,
        include: { complianceIssues: true },
      },
    },
  });
  if (contentPackage === null) {
    return { kind: "missing" as const };
  }

  const latestCheck = contentPackage.complianceChecks[0];
  const draft = contentPackage.drafts[0];
  if (draft === undefined || draft.bodyMarkdown === null) {
    return { kind: "blocked" as const, reason: "A generated draft is required before export." };
  }
  if (!hasExportReadyStatus(contentPackage.status)) {
    return { kind: "blocked" as const, reason: "Owner approval is required before export." };
  }
  const latestCheckAllowsExport =
    latestCheck !== undefined && deriveComplianceCheckExportAllowed(latestCheck.complianceIssues);
  if (
    latestCheck?.exportAllowed !== true ||
    !latestCheckAllowsExport ||
    latestCheck.draftId !== draft.id ||
    latestCheck.checkedAt < draft.updatedAt
  ) {
    return {
      kind: "blocked" as const,
      reason:
        "High risk exists, Compliance Gate has not allowed export, or the generated draft changed after the latest passing check.",
    };
  }

  const generatedAt = new Date().toISOString();
  const manifest = createExportManifest({
    content_package_id: contentPackageId,
    draft_id: draft.id,
    compliance_check_id: latestCheck.id,
    generated_at: generatedAt,
  });

  const bundle = createExportBundle(
    {
      title: draft.searchTitle ?? contentPackage.topic.title,
      body_markdown: draft.bodyMarkdown,
      disclosure_text: draft.disclosureText,
      price_notice: draft.priceNotice,
    },
    {
      content_package_id: contentPackageId,
      draft_id: draft.id,
      compliance_check_id: latestCheck.id,
      generated_at: generatedAt,
    },
  );

  const exports = await prisma.export.createManyAndReturn({
    data: bundle.map((item) => {
      const extension = extensionForFormat(item.format);
      const bundleFilename = `${contentPackageId}-${draft.id}-${item.format}.${extension}`;
      return {
        contentPackageId,
        draftId: draft.id,
        complianceCheckId: latestCheck.id,
        format: item.format,
        channel: draft.channel,
        content: item.content,
        storageKey: `exports/${contentPackageId}/${bundleFilename}`,
        bundleFilename,
        byteSize: byteSizeForExport(item.format, item.content),
        checksumSha256: checksumSha256(item.format, item.content),
        manifestJson: manifest as unknown as Prisma.InputJsonValue,
      };
    }),
  });
  await updateExportStatus({
    contentPackageId,
    currentStatus: contentPackage.status,
    currentProgress: contentPackage.progress,
  });
  await recordCostLog({
    model: "local",
    task: "exportBundle",
    pipelineStep: "export",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    blockedByCap: false,
  });

  return {
    kind: "exported" as const,
    exports: exports.map((item) => ({
      id: item.id,
      format: item.format,
      content: item.content,
      created_at: item.createdAt.toISOString(),
      draft_id: item.draftId,
      compliance_check_id: item.complianceCheckId,
      channel: item.channel,
      storage_key: item.storageKey,
      bundle_filename: item.bundleFilename,
      byte_size: item.byteSize,
      checksum_sha256: item.checksumSha256,
      manifest: item.manifestJson,
    })),
  };
}
