import { z } from "zod";

const packageStatusValues = [
  "opportunity_found",
  "paperclip_review",
  "selected",
  "assigned",
  "brief_created",
  "homefeed_packaged",
  "search_structured",
  "revenue_links_attached",
  "blog_draft_generated",
  "sns_repurposed",
  "compliance_checked",
  "owner_approval_required",
  "approved",
  "exported",
  "published_manually",
  "performance_recorded",
  "memory_updated",
  "archived",
  "rejected",
  "duplicate",
  "stale",
  "needs_research",
  "needs_link_refresh",
  "compliance_failed",
  "price_outdated",
  "policy_risk",
  "low_revenue_fit",
  "low_homefeed_fit",
] as const;

type PackageStatus = (typeof packageStatusValues)[number];
export type KanbanPackageStatus = PackageStatus;
export type KanbanColumnId =
  | "opportunities"
  | "production"
  | "review"
  | "approved"
  | "published";

type KanbanColumnDefinition = {
  readonly id: KanbanColumnId;
  readonly title: string;
  readonly targetStatus: PackageStatus;
  readonly statuses: readonly PackageStatus[];
};

const statusToColumn = {
  opportunity_found: "opportunities",
  paperclip_review: "opportunities",
  needs_research: "opportunities",
  duplicate: "opportunities",
  low_homefeed_fit: "opportunities",
  low_revenue_fit: "opportunities",
  selected: "production",
  assigned: "production",
  brief_created: "production",
  homefeed_packaged: "production",
  search_structured: "production",
  revenue_links_attached: "production",
  blog_draft_generated: "production",
  sns_repurposed: "production",
  compliance_checked: "review",
  compliance_failed: "review",
  owner_approval_required: "review",
  policy_risk: "review",
  stale: "review",
  needs_link_refresh: "review",
  price_outdated: "review",
  approved: "approved",
  exported: "approved",
  published_manually: "published",
  performance_recorded: "published",
  memory_updated: "published",
  archived: "published",
  rejected: "published",
} as const satisfies Record<PackageStatus, KanbanColumnId>;

export const kanbanColumns = [
  {
    id: "opportunities",
    title: "기회발굴",
    targetStatus: "opportunity_found",
    statuses: [
      "opportunity_found",
      "paperclip_review",
      "needs_research",
      "duplicate",
      "low_homefeed_fit",
      "low_revenue_fit",
    ],
  },
  {
    id: "production",
    title: "제작중",
    targetStatus: "assigned",
    statuses: [
      "selected",
      "assigned",
      "brief_created",
      "homefeed_packaged",
      "search_structured",
      "revenue_links_attached",
      "blog_draft_generated",
      "sns_repurposed",
    ],
  },
  {
    id: "review",
    title: "검수중",
    targetStatus: "compliance_checked",
    statuses: [
      "compliance_checked",
      "compliance_failed",
      "owner_approval_required",
      "policy_risk",
      "stale",
      "needs_link_refresh",
      "price_outdated",
    ],
  },
  { id: "approved", title: "승인대기", targetStatus: "approved", statuses: ["approved", "exported"] },
  {
    id: "published",
    title: "게시완료",
    targetStatus: "published_manually",
    statuses: ["published_manually", "performance_recorded", "memory_updated", "archived", "rejected"],
  },
] as const satisfies readonly KanbanColumnDefinition[];

export const statusLabels = {
  opportunity_found: "기회 발견",
  paperclip_review: "리뷰 중",
  selected: "선택됨",
  assigned: "배정됨",
  brief_created: "브리프",
  homefeed_packaged: "홈피드",
  search_structured: "검색 구조",
  revenue_links_attached: "링크 첨부",
  blog_draft_generated: "초안",
  sns_repurposed: "SNS 변환",
  compliance_checked: "검수 완료",
  owner_approval_required: "승인 필요",
  approved: "승인됨",
  exported: "내보냄",
  published_manually: "게시됨",
  performance_recorded: "성과 기록",
  memory_updated: "메모리 반영",
  archived: "보관",
  rejected: "폐기",
  duplicate: "중복",
  stale: "오래됨",
  needs_research: "조사 필요",
  needs_link_refresh: "링크 갱신",
  compliance_failed: "검수 실패",
  price_outdated: "가격 만료",
  policy_risk: "정책 위험",
  low_revenue_fit: "수익 낮음",
  low_homefeed_fit: "홈피드 낮음",
} as const satisfies Record<PackageStatus, string>;

const contentPackageSchema = z.object({
  id: z.string().min(1),
  topic: z.object({
    title: z.string().min(1),
    description: z.string().nullable(),
  }),
  status: z.enum(packageStatusValues),
  progress: z.number().nullable(),
  updated_at: z.string().min(1),
});

export const hqTodayResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    content_packages: z.array(contentPackageSchema),
  }),
});

export const contentPackagePatchResponseSchema = z.object({
  success: z.literal(true),
  data: contentPackageSchema,
});

export type ContentPackage = z.infer<typeof contentPackageSchema>;
export type ColumnPackages = Record<KanbanColumnId, readonly ContentPackage[]>;

export function normalizeProgress(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }
  const percent = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function updatedAtLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(
    new Date(value),
  );
}

export function groupPackages(packages: readonly ContentPackage[]): ColumnPackages {
  const grouped: Record<KanbanColumnId, ContentPackage[]> = {
    opportunities: [],
    production: [],
    review: [],
    approved: [],
    published: [],
  };
  for (const contentPackage of packages) {
    grouped[statusToColumn[contentPackage.status]].push(contentPackage);
  }
  return grouped;
}
