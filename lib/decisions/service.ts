import { type ContentPackage, DecisionValue, PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { assertCompanyProfileReady } from "@/lib/company-profile/service";
import { transitionContentPackageStatusInTransaction } from "@/lib/content/repository";
import { prisma } from "@/lib/db";

export const decisionCreateSchema = z.object({
  opportunity_memo_id: z.string().min(1),
  decision: z.enum(["selected", "on_hold", "rejected"]),
  reason: z.record(z.string(), z.unknown()).optional(),
});

export function serializeDecision(decision: {
  id: string;
  opportunityMemoId: string | null;
  decision: DecisionValue;
  priority: number;
  createdAt: Date;
}) {
  return {
    id: decision.id,
    opportunity_memo_id: decision.opportunityMemoId,
    decision: decision.decision,
    priority: decision.priority,
    created_at: decision.createdAt.toISOString(),
  };
}

export async function createPaperclipDecision(input: z.infer<typeof decisionCreateSchema>) {
  const memo = await prisma.opportunityMemo.findUniqueOrThrow({
    where: { id: input.opportunity_memo_id },
  });

  if (input.decision === "selected") {
    await assertCompanyProfileReady();

    const result = await prisma.$transaction(async (tx) => {
      const decision = await tx.paperclipDecision.create({
        data: {
          opportunityMemoId: memo.id,
          decision: DecisionValue.selected,
          ...(input.reason === undefined ? {} : { reason: input.reason as Prisma.InputJsonValue }),
          assignedProfiles: ["NaverBlogProfile"],
        },
      });
      const topic = await tx.topic.create({
        data: {
          paperclipDecisionId: decision.id,
          title: memo.topic,
          description: memo.whyNow,
        },
      });
      const contentPackage = await tx.contentPackage.create({
        data: {
          paperclipDecisionId: decision.id,
          topicId: topic.id,
          homefeedScore: memo.homefeedScore,
          searchScore: memo.searchScore,
          revenueScore: memo.revenueScore,
          riskScore: memo.riskScore,
          status: PackageStatus.assigned,
          progress: 0,
        },
      });
      await tx.opportunityMemo.update({ where: { id: memo.id }, data: { status: "selected" } });
      return { decision, contentPackage };
    });
    return {
      decision: serializeDecision(result.decision),
      content_package_id: result.contentPackage.id,
    };
  }

  const decisionValue =
    input.decision === "on_hold" ? DecisionValue.on_hold : DecisionValue.rejected;
  const decision = await prisma.paperclipDecision.create({
    data: {
      opportunityMemoId: memo.id,
      decision: decisionValue,
      ...(input.reason === undefined ? {} : { reason: input.reason as Prisma.InputJsonValue }),
      assignedProfiles: [],
    },
  });
  await prisma.opportunityMemo.update({
    where: { id: memo.id },
    data: { status: input.decision === "on_hold" ? "on_hold" : "archived" },
  });

  return {
    decision: serializeDecision(decision),
    content_package_id: null,
  };
}

export async function getPaperclipDecision(id: string) {
  const decision = await prisma.paperclipDecision.findUnique({ where: { id } });
  return decision === null ? null : serializeDecision(decision);
}

export async function setDecisionPackageStatus(id: string, status: PackageStatus) {
  const decision = await prisma.paperclipDecision.findUnique({
    where: { id },
    include: { contentPackages: true },
  });
  if (decision === null) {
    return null;
  }

  const updatedPackages = await prisma.$transaction(async (tx) => {
    const packages: ContentPackage[] = [];
    for (const contentPackage of decision.contentPackages) {
      const updated = await transitionContentPackageStatusInTransaction(tx, {
        id: contentPackage.id,
        fromStatus: contentPackage.status,
        toStatus: status,
        actor: "owner",
        reason: `Owner ${status}`,
      });
      packages.push(updated);
    }
    return packages;
  });

  return {
    decision: serializeDecision(decision),
    content_packages: updatedPackages.map((contentPackage) => ({
      id: contentPackage.id,
      status: contentPackage.status,
    })),
  };
}
