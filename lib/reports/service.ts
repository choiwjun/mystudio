import { prisma } from "@/lib/db";
import { getRevenueSummary, listPerformanceLogs } from "@/lib/performance/service";

const staleLinkDays = 7;
const dayMs = 24 * 60 * 60 * 1000;

type PackageReportRecord = Awaited<ReturnType<typeof loadReportPackages>>[number];
type RevenueLogRecord = Awaited<ReturnType<typeof loadReportRevenueLogs>>[number];

export type ReportInsight = {
  readonly title: string;
  readonly detail: string;
  readonly action: string;
};

function periodStart(days: number): Date {
  return new Date(Date.now() - days * dayMs);
}

function nextMonthCalendar(categories: readonly string[]): readonly ReportInsight[] {
  const fallbackCategories = categories.length === 0 ? ["생활", "쇼핑", "검색"] : categories;
  return fallbackCategories.slice(0, 4).map((category, index) => ({
    title: `${index + 1}주차 ${category} 콘텐츠`,
    detail: `${category} 카테고리의 검색형 비교 글과 홈피드 공감형 제목을 함께 준비합니다.`,
    action: "Hermes 기회 메모를 생성하고 상품 링크를 먼저 점검하세요.",
  }));
}

async function loadReportPackages() {
  return prisma.contentPackage.findMany({
    include: {
      topic: true,
      drafts: true,
      performanceLogs: true,
      shoppingConnectLinks: { include: { product: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

async function loadReportRevenueLogs() {
  return prisma.revenueLog.findMany({
    include: { product: true },
    orderBy: { orderedAt: "desc" },
    take: 200,
  });
}

function packageRevenue(
  contentPackage: PackageReportRecord,
  revenueLogs: readonly RevenueLogRecord[],
) {
  const directRevenue = contentPackage.performanceLogs.reduce(
    (total, log) => total + (log.directRevenue ?? 0),
    0,
  );
  const linkedProductIds = new Set(
    contentPackage.shoppingConnectLinks.map((link) => link.productId).filter(Boolean),
  );
  const indirectRevenue = revenueLogs
    .filter((log) => linkedProductIds.has(log.productId))
    .reduce((total, log) => total + log.amount, 0);
  return { directRevenue, indirectRevenue, totalRevenue: directRevenue + indirectRevenue };
}

function contentRoiRows(
  packages: readonly PackageReportRecord[],
  revenueLogs: readonly RevenueLogRecord[],
) {
  return packages
    .map((contentPackage) => {
      const views = contentPackage.performanceLogs.reduce((total, log) => total + log.views, 0);
      const clicks = contentPackage.performanceLogs.reduce(
        (total, log) => total + (log.clicks ?? 0),
        0,
      );
      const revenue = packageRevenue(contentPackage, revenueLogs);
      return {
        id: contentPackage.id,
        title: contentPackage.topic.title,
        status: contentPackage.status,
        views,
        clicks,
        revenue: revenue.totalRevenue,
        revenue_per_1000_views: views === 0 ? 0 : Math.round((revenue.totalRevenue / views) * 1000),
      };
    })
    .sort((left, right) => right.revenue - left.revenue);
}

function rewriteRecommendations(
  roiRows: ReturnType<typeof contentRoiRows>,
): readonly ReportInsight[] {
  return roiRows
    .filter((row) => row.views >= 100 && (row.revenue === 0 || row.clicks / row.views < 0.02))
    .slice(0, 5)
    .map((row) => ({
      title: row.title,
      detail: `조회 ${row.views.toLocaleString("ko-KR")}회, 클릭 ${row.clicks.toLocaleString(
        "ko-KR",
      )}회, 수익 ${row.revenue.toLocaleString("ko-KR")}원입니다.`,
      action: "첫 화면 CTA, 비교표, 제휴 링크 위치를 다시 생성하고 재검수하세요.",
    }));
}

function linkRefreshRecommendations(
  packages: readonly PackageReportRecord[],
): readonly ReportInsight[] {
  const cutoff = periodStart(staleLinkDays);
  return packages
    .flatMap((contentPackage) =>
      contentPackage.shoppingConnectLinks.map((link) => ({ contentPackage, link })),
    )
    .filter(({ link }) => link.linkCheckedAt === null || link.linkCheckedAt < cutoff)
    .slice(0, 8)
    .map(({ contentPackage, link }) => ({
      title: link.product.productName,
      detail: `${contentPackage.topic.title}에 연결된 링크가 ${
        link.linkCheckedAt === null ? "아직 확인되지 않았습니다" : "7일 이상 갱신되지 않았습니다"
      }.`,
      action: "가격, 품절, 제휴 URL 유효성을 확인하고 링크 배치를 갱신하세요.",
    }));
}

export async function getReportIntelligence() {
  const [revenue, performance, packages, revenueLogs] = await Promise.all([
    getRevenueSummary(),
    listPerformanceLogs("week"),
    loadReportPackages(),
    loadReportRevenueLogs(),
  ]);
  const roiRows = contentRoiRows(packages, revenueLogs);
  const topCategories = revenue.category_rankings.map((item) => item.category);
  const weeklyReview = {
    title: "주간 운영 리뷰",
    detail: `최근 주간 평균 조회 ${performance.summary.average_views.toLocaleString(
      "ko-KR",
    )}회, 평균 클릭 ${performance.summary.average_clicks.toLocaleString("ko-KR")}회입니다.`,
    action:
      performance.summary.best_hook_type === null
        ? "성과 샘플을 더 기록해 후킹 패턴을 학습시키세요."
        : `${performance.summary.best_hook_type} 후킹을 다음 발행 후보에 우선 적용하세요.`,
  };
  const monthlyPnl = {
    title: "월간 손익",
    detail: `직접 수익 ${revenue.direct_total.toLocaleString(
      "ko-KR",
    )}원, 간접 수익 ${revenue.indirect_total.toLocaleString("ko-KR")}원입니다.`,
    action: `월 목표 대비 ${revenue.progress_rate}%입니다. 상위 카테고리를 다음 캘린더에 반영하세요.`,
  };

  return {
    revenue,
    performance,
    weekly_review: weeklyReview,
    monthly_pnl: monthlyPnl,
    next_month_calendar: nextMonthCalendar(topCategories),
    paperclip_strategy: [
      {
        title: "카테고리 집중",
        detail:
          revenue.top_category === null
            ? "아직 수익 우위 카테고리가 없습니다."
            : `${revenue.top_category} 카테고리가 현재 최상위 수익원입니다.`,
        action: "상위 카테고리의 비교형 검색 글과 홈피드형 문제 해결 글을 함께 편성하세요.",
      },
    ],
    product_revenue_dashboard: revenue.category_rankings,
    content_roi: roiRows.slice(0, 10),
    rewrite_recommendations: rewriteRecommendations(roiRows),
    link_refresh_recommendations: linkRefreshRecommendations(packages),
  };
}
