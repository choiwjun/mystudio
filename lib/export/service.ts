import { PackageStatus } from "@prisma/client";
import { z } from "zod";
import { transitionContentPackageStatus } from "@/lib/content/repository";
import { prisma } from "@/lib/db";
import { NaverExportAdapter } from "@/lib/export/publisherAdapter";
import { recordCostLog } from "@/lib/logging/costLogger";

export const exportRequestSchema = z.object({
  format: z.enum(["markdown", "html", "copy", "zip"]).optional(),
});

export async function exportContentPackage(contentPackageId: string) {
  const contentPackage = await prisma.contentPackage.findUnique({
    where: { id: contentPackageId },
    include: {
      topic: true,
      drafts: { orderBy: { updatedAt: "desc" }, take: 1 },
      complianceChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });
  if (contentPackage === null) {
    return { kind: "missing" as const };
  }

  const latestCheck = contentPackage.complianceChecks[0];
  if (latestCheck?.exportAllowed !== true) {
    return {
      kind: "blocked" as const,
      reason: "High risk exists or Compliance Gate has not allowed export.",
    };
  }

  const draft = contentPackage.drafts[0];
  if (draft === undefined || draft.bodyMarkdown === null) {
    return { kind: "blocked" as const, reason: "A generated draft is required before export." };
  }

  const adapter = new NaverExportAdapter();
  const bundle = adapter.createBundle({
    title: draft.searchTitle ?? contentPackage.topic.title,
    body_markdown: draft.bodyMarkdown,
    disclosure_text: draft.disclosureText,
    price_notice: draft.priceNotice,
  });

  const exports = await prisma.export.createManyAndReturn({
    data: bundle.map((item) => ({
      contentPackageId,
      format: item.format,
      content: item.content,
    })),
  });
  await transitionContentPackageStatus({
    id: contentPackageId,
    fromStatus: contentPackage.status,
    toStatus: PackageStatus.exported,
    progress: 0.9,
    reason: "Export bundle generated",
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
    })),
  };
}
