import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hqPageSource = readFileSync("app/(app)/page.tsx", "utf8");
const appHeaderSource = readFileSync("components/AppHeader.tsx", "utf8");
const appHeaderActionsSource = readFileSync("components/AppHeaderActions.tsx", "utf8");
const hqStatusBadgeSource = readFileSync("components/hq/HqStatusBadge.tsx", "utf8");
const hqKanbanBoardSource = readFileSync("components/hq/HqKanbanBoard.tsx", "utf8");
const hqKanbanMappingSource = readFileSync("components/hq/kanban.ts", "utf8");
const hqBriefingPanelSource = readFileSync("components/hq/HqBriefingPanel.tsx", "utf8");
const hqCommandActionsSource = readFileSync("components/hq/HqCommandActions.tsx", "utf8");
const hqDailyBriefingButtonSource = readFileSync("components/hq/HqDailyBriefingButton.tsx", "utf8");
const hqOpportunityMemoListSource = readFileSync("components/hq/HqOpportunityMemoList.tsx", "utf8");
const hqProfileSetupModalSource = readFileSync("components/hq/HqProfileSetupModal.tsx", "utf8");
const hqRefreshNeededPanelSource = readFileSync("components/hq/HqRefreshNeededPanel.tsx", "utf8");
const hqRightRailSummarySource = readFileSync("components/hq/HqRightRailSummary.tsx", "utf8");
const hqWinningPatternsPanelSource = readFileSync(
  "components/hq/HqWinningPatternsPanel.tsx",
  "utf8",
);
const contentPackageRouteSource = readFileSync("app/api/content-packages/[id]/route.ts", "utf8");
const contentServiceSource = readFileSync("lib/content/service.ts", "utf8");
const companyProfileServiceSource = readFileSync("lib/company-profile/service.ts", "utf8");
const decisionServiceSource = readFileSync("lib/decisions/service.ts", "utf8");
const hqDailyBriefingRouteSource = readFileSync("app/api/hq/daily-briefing/route.ts", "utf8");
const hqServiceSource = readFileSync("lib/hq/service.ts", "utf8");
const sharedTypesSource = readFileSync("specs/shared/types.yaml", "utf8");
const performancePageSource = readFileSync("app/(app)/performance/page.tsx", "utf8");
const performanceRecorderSource = readFileSync(
  "components/performance/PerformanceRecorder.tsx",
  "utf8",
);

const requiredKanbanColumns = [
  "opportunities",
  "production",
  "review",
  "approved",
  "published",
] as const;

const requiredPackageStatuses = [
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

describe("HQ main screen contract", () => {
  it("surfaces refresh-needed products and links in the HQ right rail", () => {
    expect(hqServiceSource).toContain("refresh_needed: winningPatterns.refresh_candidates");
    expect(hqPageSource).toContain("HqRefreshNeededPanel");
    expect(hqRefreshNeededPanelSource).toContain('fetch("/api/hq/today")');
    expect(hqRefreshNeededPanelSource).toContain("hqRefreshNeededResponseSchema");
    expect(hqRefreshNeededPanelSource).toContain("hqRefreshNeededResponseSchema.parse");
    expect(hqRefreshNeededPanelSource).toContain("payload.data.refresh_needed");
    expect(hqRefreshNeededPanelSource).not.toContain("as HqTodayPayload");
    expect(hqRefreshNeededPanelSource).toContain("가격 기준일 오래");
    expect(hqRefreshNeededPanelSource).toContain("링크 상태 확인");
    expect(hqPageSource).not.toContain("가격 갱신 1건 · 링크 갱신 1건");
  });

  it("wires HQ opportunity memo cards to decision actions", () => {
    expect(hqPageSource).toContain("HqOpportunityMemoList");
    expect(hqPageSource).not.toContain("const memos = [");
    expect(hqOpportunityMemoListSource).toContain('fetch("/api/hermes/opportunity-memos")');
    expect(hqOpportunityMemoListSource).toContain('fetch("/api/auth/session")');
    expect(hqOpportunityMemoListSource).toContain('fetch("/api/hq/decisions"');
    expect(hqOpportunityMemoListSource).toContain("sessionResponseSchema");
    expect(hqOpportunityMemoListSource).toContain("csrf_token: z.string().min(1)");
    expect(hqOpportunityMemoListSource).not.toContain("function redirectToLogin()");
    expect(hqOpportunityMemoListSource).not.toContain("/login?from=");
    expect(hqOpportunityMemoListSource).toContain("decision: decisionValue");
    expect(hqOpportunityMemoListSource).toContain("hiddenMemoStatuses");
    expect(hqOpportunityMemoListSource).not.toContain('memo.status === "new"');
    expect(hqOpportunityMemoListSource).toContain("window.location.assign(`/packages/${");
    expect(hqOpportunityMemoListSource).toContain("setMemos((current) =>");
    expect(hqOpportunityMemoListSource).toContain('"x-csrf-token": csrfToken');
    expect(hqOpportunityMemoListSource).not.toContain("Authorization");
    expect(hqOpportunityMemoListSource).not.toContain("Bearer");
  });

  it("syncs the HQ kanban board from content package status mapping", () => {
    expect(hqPageSource).toContain("HqKanbanBoard");
    expect(hqPageSource).not.toContain("const kanbanColumns = [");
    expect(hqPageSource).not.toContain('href="/packages/demo"');
    expect(hqKanbanBoardSource).toContain('fetch("/api/hq/today")');
    expect(hqKanbanBoardSource).toContain("todayPayload.data.content_packages");
    expect(hqKanbanBoardSource).toContain("progress-meter");

    for (const column of requiredKanbanColumns) {
      expect(sharedTypesSource).toContain(`${column}:`);
      expect(hqKanbanMappingSource).toContain(`id: "${column}"`);
    }

    for (const status of requiredPackageStatuses) {
      expect(sharedTypesSource).toContain(`- ${status}`);
      expect(hqKanbanMappingSource).toContain(status);
    }
  });

  it("syncs the HQ right rail from live HQ summary data", () => {
    expect(hqPageSource).toContain("HqRightRailSummary");
    expect(hqPageSource).not.toContain("승인 대기 콘텐츠 1건");
    expect(hqPageSource).not.toContain("이번 달 128,000원 / 목표 500,000원");
    expect(hqRightRailSummarySource).toContain('fetch("/api/hq/today")');
    expect(hqRightRailSummarySource).toContain("setSummary(payload.data)");
    expect(hqRightRailSummarySource).toContain("summary.hq_status.pending_approvals");
    expect(hqRightRailSummarySource).toContain("summary.revenue_summary.month_total");
    expect(hqRightRailSummarySource).toContain("complianceSeverityCounts");
    expect(hqRightRailSummarySource).toContain("오너 승인 대기열");
    expect(hqRightRailSummarySource).toContain("검수 알림");
    expect(hqRightRailSummarySource).toContain("수익 요약");
  });

  it("syncs HQ briefing and winning patterns from live HQ data", () => {
    expect(hqPageSource).toContain("HqBriefingPanel");
    expect(hqPageSource).toContain("HqWinningPatternsPanel");
    expect(hqPageSource).not.toContain("블로그 1개를 승인 가능한 상태까지 진행하고");
    expect(hqPageSource).not.toContain("checklist 평균 200 views");
    expect(hqBriefingPanelSource).toContain('fetch("/api/hq/today")');
    expect(hqBriefingPanelSource).toContain("payload.data.hq_briefing");
    expect(hqBriefingPanelSource).toContain("focus_categories");
    expect(hqWinningPatternsPanelSource).toContain('fetch("/api/hq/today")');
    expect(hqWinningPatternsPanelSource).toContain("payload.data.winning_patterns");
    expect(hqWinningPatternsPanelSource).toContain("hook_type_stats");
    expect(hqWinningPatternsPanelSource).toContain("top_product_categories");
    expect(hqWinningPatternsPanelSource).toContain("refresh_candidates");
  });

  it("generates HQ daily briefing through the runtime AI adapter with profile and memo context", () => {
    expect(hqServiceSource).toContain("createRuntimeAIAdapterFromConfiguredCredentials");
    expect(hqServiceSource).toContain("adapter.generateDailyBriefing");
    expect(hqServiceSource).toContain("serializeDailyBriefingCompanyProfile(profile)");
    expect(hqServiceSource).toContain("opportunityMemoContext");
    expect(hqServiceSource).toContain("latestMemo:");
    expect(hqServiceSource).toContain("recentMemos: recentMemos.map");
    expect(hqServiceSource).toContain("goals: aiBriefing.goals");
    expect(hqServiceSource).toContain("focusCategories: aiBriefing.focus_categories");
    expect(hqServiceSource).not.toContain(
      'goals: "오늘 콘텐츠 1개를 승인 가능한 상태까지 진행합니다."',
    );
  });

  it("updates content package status from HQ kanban drag and drop", () => {
    expect(contentServiceSource).toContain("contentPackageStatusPatchSchema");
    expect(contentServiceSource).toContain("updateContentPackageStatus");
    expect(contentServiceSource).toContain("transitionContentPackageStatus");
    expect(contentPackageRouteSource).toContain("export async function PATCH");
    expect(contentPackageRouteSource).toContain("contentPackageStatusPatchSchema.safeParse");
    expect(contentPackageRouteSource).toContain("updateContentPackageStatus(params.id");
    expect(hqKanbanMappingSource).toContain("targetStatus");
    expect(hqKanbanMappingSource).toContain('targetStatus: "opportunity_found"');
    expect(hqKanbanMappingSource).toContain('targetStatus: "assigned"');
    expect(hqKanbanMappingSource).toContain('targetStatus: "compliance_checked"');
    expect(hqKanbanMappingSource).toContain('targetStatus: "approved"');
    expect(hqKanbanMappingSource).toContain('targetStatus: "published_manually"');
    expect(hqKanbanBoardSource).toContain('fetch("/api/auth/session")');
    expect(hqKanbanBoardSource).toContain("onDragStart");
    expect(hqKanbanBoardSource).toContain("onDrop");
    expect(hqKanbanBoardSource).toContain("x-csrf-token");
    expect(hqKanbanBoardSource).toContain("sessionResponseSchema");
    expect(hqKanbanBoardSource).toContain("csrf_token: z.string().min(1)");
    expect(hqKanbanBoardSource).not.toContain('window.location.assign("/login?from=/")');
    expect(hqKanbanBoardSource).toContain("contentPackagePatchResponseSchema");
    expect(hqKanbanBoardSource).not.toContain("Authorization");
    expect(hqKanbanBoardSource).not.toContain("Bearer");
  });

  it("guards HQ generation and selection when company profile setup is incomplete", () => {
    expect(companyProfileServiceSource).toContain("CompanyProfileSetupRequiredError");
    expect(companyProfileServiceSource).toContain("profileSetupRequiredError");
    expect(decisionServiceSource).toContain("assertCompanyProfileReady()");
    expect(hqServiceSource).toContain("assertCompanyProfileReady()");
    expect(companyProfileServiceSource).toContain("PROFILE_SETUP_REQUIRED");
    expect(hqDailyBriefingRouteSource).toContain("isCompanyProfileSetupRequiredError");

    expect(hqPageSource).toContain("HqCommandActions");
    expect(hqPageSource).not.toContain('href="/api/hq/daily-briefing"');
    expect(hqCommandActionsSource).toContain("HqDailyBriefingButton");
    expect(hqDailyBriefingButtonSource).toContain('fetch("/api/company-profile")');
    expect(hqDailyBriefingButtonSource).toContain("setup_required");
    expect(hqDailyBriefingButtonSource).toContain("HqProfileSetupModal");
    expect(hqOpportunityMemoListSource).toContain('fetch("/api/company-profile")');
    expect(hqOpportunityMemoListSource).toContain("profileSetupRequired");
    expect(hqOpportunityMemoListSource).toContain("setProfileGuardOpen(true)");
    expect(hqProfileSetupModalSource).toContain('role="dialog"');
    expect(hqProfileSetupModalSource).toContain('href="/settings"');
    expect(hqProfileSetupModalSource).toContain("회사 프로필 설정이 필요합니다");
  });

  it("uses the live guarded daily briefing action in the global app header", () => {
    expect(appHeaderSource).toContain("AppHeaderActions");
    expect(appHeaderSource).not.toContain("P4 HQ 브리핑 API 구현 후 활성화됩니다.");
    expect(appHeaderSource).not.toContain("disabled title=");
    expect(appHeaderActionsSource).toContain("HqDailyBriefingButton");
    expect(appHeaderActionsSource).not.toContain('fetch("/api/auth/logout"');
    expect(appHeaderActionsSource).toContain('href="/settings"');
    expect(hqCommandActionsSource).toContain("HqDailyBriefingButton");
    expect(hqDailyBriefingButtonSource).toContain('fetch("/api/company-profile")');
    expect(hqDailyBriefingButtonSource).toContain('fetch("/api/auth/session")');
    expect(hqDailyBriefingButtonSource).toContain('fetch("/api/hq/daily-briefing"');
    expect(hqDailyBriefingButtonSource).toContain("x-csrf-token");
    expect(hqDailyBriefingButtonSource).toContain("sessionResponseSchema");
    expect(hqDailyBriefingButtonSource).toContain("csrf_token: z.string().min(1)");
    expect(hqDailyBriefingButtonSource).toContain("DATABASE_URL_REQUIRED");
    expect(hqDailyBriefingButtonSource).toContain(
      "DATABASE_URL 설정이 없어 브리핑을 저장할 수 없습니다.",
    );
    expect(hqDailyBriefingButtonSource).not.toContain("function redirectToLogin()");
    expect(hqDailyBriefingButtonSource).not.toContain("/login?from=");
    expect(hqDailyBriefingButtonSource).toContain("setProfileGuardOpen(true)");
    expect(hqDailyBriefingButtonSource).not.toContain("Authorization");
    expect(hqDailyBriefingButtonSource).not.toContain("Bearer");
  });
  it("renders live HQ status and performance reminder counts instead of static header copy", () => {
    expect(appHeaderSource).toContain("HqStatusBadge");
    expect(hqPageSource).toContain("HqStatusBadge");
    expect(performancePageSource).toContain("HqStatusBadge");
    expect(hqStatusBadgeSource).toContain('fetch("/api/hq/status")');
    expect(hqStatusBadgeSource).toContain("needs_performance_log");
    expect(hqStatusBadgeSource).toContain("ai_budget");
    expect(hqStatusBadgeSource).toContain("window.addEventListener(hqStatusRefreshEvent");
    expect(hqStatusBadgeSource).toContain("window.removeEventListener(hqStatusRefreshEvent");
    expect(performanceRecorderSource).toContain("requestHqStatusRefresh()");
    expect(performanceRecorderSource.indexOf("requestHqStatusRefresh();")).toBeLessThan(
      performanceRecorderSource.indexOf("const performance = await getApiData<SummaryPayload>"),
    );
    expect(performanceRecorderSource).toContain("요약 새로고침 실패");
    expect(appHeaderSource).not.toContain("Status Focus");
    expect(hqPageSource).not.toContain("성과 미기록 1건");
    expect(performancePageSource).not.toContain("성과 미기록 1건");
    expect(performanceRecorderSource).not.toContain("성과 미기록 1건");
  });
});
