import { PackageStatus } from "@prisma/client";

export type PackageStatusTransitionBypass = {
  readonly kind: "admin_seed";
  readonly actor: "admin" | "seed";
  readonly reason: string;
};

const terminalStatuses = [
  PackageStatus.archived,
  PackageStatus.rejected,
  PackageStatus.duplicate,
  PackageStatus.stale,
] as const;

const exceptionStatuses = [
  PackageStatus.needs_research,
  PackageStatus.needs_link_refresh,
  PackageStatus.compliance_failed,
  PackageStatus.price_outdated,
  PackageStatus.policy_risk,
  PackageStatus.low_revenue_fit,
  PackageStatus.low_homefeed_fit,
] as const;

const commonExceptionAndTerminalTransitions = [...terminalStatuses, ...exceptionStatuses] as const;
export const performanceRecordableStatuses = [
  PackageStatus.exported,
  PackageStatus.published_manually,
] as const;

export const packageStatusTransitionMatrix = {
  [PackageStatus.opportunity_found]: [
    PackageStatus.paperclip_review,
    PackageStatus.selected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.paperclip_review]: [
    PackageStatus.selected,
    PackageStatus.assigned,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.selected]: [
    PackageStatus.assigned,
    PackageStatus.brief_created,
    PackageStatus.homefeed_packaged,
    PackageStatus.search_structured,
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.assigned]: [
    PackageStatus.brief_created,
    PackageStatus.homefeed_packaged,
    PackageStatus.search_structured,
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.brief_created]: [
    PackageStatus.homefeed_packaged,
    PackageStatus.search_structured,
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.homefeed_packaged]: [
    PackageStatus.search_structured,
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.search_structured]: [
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.sns_repurposed,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.revenue_links_attached]: [
    PackageStatus.blog_draft_generated,
    PackageStatus.sns_repurposed,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.blog_draft_generated]: [
    PackageStatus.sns_repurposed,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.sns_repurposed]: [
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.compliance_checked]: [
    PackageStatus.owner_approval_required,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.owner_approval_required]: [
    PackageStatus.approved,
    PackageStatus.rejected,
    PackageStatus.compliance_failed,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.approved]: [
    PackageStatus.exported,
    PackageStatus.published_manually,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.exported]: [
    PackageStatus.published_manually,
    PackageStatus.performance_recorded,
    PackageStatus.memory_updated,
    ...commonExceptionAndTerminalTransitions,
  ],
  [PackageStatus.published_manually]: [
    PackageStatus.performance_recorded,
    PackageStatus.memory_updated,
    PackageStatus.archived,
    PackageStatus.needs_link_refresh,
    PackageStatus.price_outdated,
    PackageStatus.policy_risk,
  ],
  [PackageStatus.performance_recorded]: [
    PackageStatus.memory_updated,
    PackageStatus.archived,
    PackageStatus.needs_link_refresh,
    PackageStatus.price_outdated,
  ],
  [PackageStatus.memory_updated]: [PackageStatus.archived],
  [PackageStatus.archived]: [],
  [PackageStatus.rejected]: [PackageStatus.needs_research, PackageStatus.archived],
  [PackageStatus.duplicate]: [PackageStatus.archived],
  [PackageStatus.stale]: [
    PackageStatus.needs_research,
    PackageStatus.needs_link_refresh,
    PackageStatus.archived,
  ],
  [PackageStatus.needs_research]: [
    PackageStatus.brief_created,
    PackageStatus.search_structured,
    PackageStatus.rejected,
    PackageStatus.stale,
    PackageStatus.archived,
  ],
  [PackageStatus.needs_link_refresh]: [
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.archived,
  ],
  [PackageStatus.compliance_failed]: [
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.policy_risk,
    PackageStatus.rejected,
    PackageStatus.archived,
  ],
  [PackageStatus.price_outdated]: [
    PackageStatus.revenue_links_attached,
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.archived,
  ],
  [PackageStatus.policy_risk]: [
    PackageStatus.blog_draft_generated,
    PackageStatus.compliance_checked,
    PackageStatus.compliance_failed,
    PackageStatus.rejected,
    PackageStatus.archived,
  ],
  [PackageStatus.low_revenue_fit]: [
    PackageStatus.revenue_links_attached,
    PackageStatus.rejected,
    PackageStatus.stale,
    PackageStatus.archived,
  ],
  [PackageStatus.low_homefeed_fit]: [
    PackageStatus.homefeed_packaged,
    PackageStatus.search_structured,
    PackageStatus.rejected,
    PackageStatus.stale,
    PackageStatus.archived,
  ],
} satisfies Record<PackageStatus, readonly PackageStatus[]>;

export function isPackageStatusTransitionAllowed(
  fromStatus: PackageStatus,
  toStatus: PackageStatus,
): boolean {
  return (
    fromStatus === toStatus ||
    (packageStatusTransitionMatrix[fromStatus] as readonly PackageStatus[]).includes(toStatus)
  );
}

export class IllegalPackageStatusTransitionError extends Error {
  constructor(fromStatus: PackageStatus, toStatus: PackageStatus) {
    super(`Illegal package status transition: ${fromStatus} -> ${toStatus}.`);
    this.name = "IllegalPackageStatusTransitionError";
  }
}

export function assertPackageStatusTransitionAllowed(
  fromStatus: PackageStatus,
  toStatus: PackageStatus,
  bypass?: PackageStatusTransitionBypass,
): void {
  if (bypass !== undefined) {
    return;
  }
  if (!isPackageStatusTransitionAllowed(fromStatus, toStatus)) {
    throw new IllegalPackageStatusTransitionError(fromStatus, toStatus);
  }
}
