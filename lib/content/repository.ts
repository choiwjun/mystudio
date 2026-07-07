import type { ContentPackage, PackageStatus, Prisma } from "@prisma/client";
import {
  assertPackageStatusTransitionAllowed,
  type PackageStatusTransitionBypass,
} from "@/lib/content/statusTransitions";
import { prisma } from "@/lib/db";

export const contentPackageInclude = {
  topic: true,
  paperclipDecision: { include: { opportunityMemo: { include: { keywordClusters: true } } } },
  drafts: { orderBy: { updatedAt: "desc" } },
  titleCandidates: { orderBy: { createdAt: "asc" } },
  complianceChecks: {
    include: { complianceIssues: true },
    orderBy: { checkedAt: "desc" },
  },
  exports: { orderBy: { createdAt: "desc" } },
  shoppingConnectLinks: { include: { product: true } },
} satisfies Prisma.ContentPackageInclude;

export type ContentPackageRecord = Prisma.ContentPackageGetPayload<{
  include: typeof contentPackageInclude;
}>;

export async function loadContentPackageRecord(id: string): Promise<ContentPackageRecord | null> {
  return prisma.contentPackage.findUnique({
    where: { id },
    include: contentPackageInclude,
  });
}

export async function listContentPackageRecords(
  status: PackageStatus | null,
): Promise<ContentPackageRecord[]> {
  return prisma.contentPackage.findMany({
    where: status === null ? {} : { status },
    include: contentPackageInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export type ContentPackageStatusTransitionInput = {
  readonly id: string;
  readonly fromStatus: PackageStatus;
  readonly toStatus: PackageStatus;
  readonly actor?: string;
  readonly reason?: string;
  readonly progress?: number;
  readonly bypass?: PackageStatusTransitionBypass;
};

export async function transitionContentPackageStatusInTransaction(
  tx: Prisma.TransactionClient,
  input: ContentPackageStatusTransitionInput,
): Promise<ContentPackage> {
  assertPackageStatusTransitionAllowed(input.fromStatus, input.toStatus, input.bypass);
  if (input.fromStatus === input.toStatus) {
    return tx.contentPackage.findUniqueOrThrow({
      where: { id: input.id },
    });
  }

  const updated = await tx.contentPackage.update({
    where: { id: input.id },
    data: {
      status: input.toStatus,
      ...(input.progress === undefined ? {} : { progress: input.progress }),
    },
  });
  await tx.statusTransition.create({
    data: {
      contentPackageId: input.id,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actor: input.actor ?? "system",
      reason: input.reason ?? "Pipeline transition",
    },
  });
  return updated;
}
export async function updateContentPackageProgress(input: {
  readonly id: string;
  readonly progress: number;
}): Promise<ContentPackage> {
  return prisma.contentPackage.update({
    where: { id: input.id },
    data: { progress: input.progress },
  });
}

export async function transitionContentPackageStatus(
  input: ContentPackageStatusTransitionInput,
): Promise<ContentPackage> {
  return prisma.$transaction((tx) => transitionContentPackageStatusInTransaction(tx, input));
}
