export type PerformanceMetricInput = {
  readonly views: number;
  readonly clicks: number;
  readonly direct_revenue: number;
  readonly hook_type: string | null;
};

export type RevenueMetricInput = {
  readonly content_title: string;
  readonly direct_revenue: number;
  readonly indirect_revenue: number;
  readonly category?: string | null;
};

export function detectPlatformFromUrl(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("blog.naver.com")) {
    return "naver_blog";
  }
  if (hostname.includes("instagram.com")) {
    return "instagram";
  }
  if (hostname.includes("threads.net")) {
    return "threads";
  }
  return "manual";
}

export function summarizePerformance(logs: readonly PerformanceMetricInput[]): {
  readonly average_views: number;
  readonly average_clicks: number;
  readonly average_revenue: number;
  readonly best_hook_type: string | null;
} {
  if (logs.length === 0) {
    return { average_views: 0, average_clicks: 0, average_revenue: 0, best_hook_type: null };
  }

  const totals = logs.reduce(
    (accumulator, log) => ({
      views: accumulator.views + log.views,
      clicks: accumulator.clicks + log.clicks,
      revenue: accumulator.revenue + log.direct_revenue,
    }),
    { views: 0, clicks: 0, revenue: 0 },
  );
  const hookStats = new Map<string, { totalViews: number; count: number }>();
  for (const log of logs) {
    if (log.hook_type !== null) {
      const previous = hookStats.get(log.hook_type) ?? { totalViews: 0, count: 0 };
      hookStats.set(log.hook_type, {
        totalViews: previous.totalViews + log.views,
        count: previous.count + 1,
      });
    }
  }
  const bestHook = [...hookStats.entries()].sort(
    (left, right) => right[1].totalViews / right[1].count - left[1].totalViews / left[1].count,
  )[0];

  return {
    average_views: Math.round(totals.views / logs.length),
    average_clicks: Math.round(totals.clicks / logs.length),
    average_revenue: Math.round(totals.revenue / logs.length),
    best_hook_type: bestHook?.[0] ?? null,
  };
}

export function summarizeRevenue(
  logs: readonly RevenueMetricInput[],
  goalMonthly: number,
): {
  readonly month_total: number;
  readonly direct_total: number;
  readonly indirect_total: number;
  readonly goal_monthly: number;
  readonly progress_rate: number;
  readonly top_content_title: string | null;
  readonly top_content_revenue: number;
  readonly top_category: string | null;
  readonly category_rankings: readonly {
    readonly category: string;
    readonly revenue: number;
    readonly sample_count: number;
  }[];
} {
  const directTotal = logs.reduce((total, log) => total + log.direct_revenue, 0);
  const indirectTotal = logs.reduce((total, log) => total + log.indirect_revenue, 0);
  const ranked = logs
    .map((log) => ({
      title: log.content_title,
      revenue: log.direct_revenue + log.indirect_revenue,
    }))
    .sort((left, right) => right.revenue - left.revenue);
  const top = ranked[0] ?? null;
  const categoryTotals = new Map<string, { revenue: number; sampleCount: number }>();
  for (const log of logs) {
    const category = log.category?.trim();
    if (category !== undefined && category.length > 0) {
      const previous = categoryTotals.get(category) ?? { revenue: 0, sampleCount: 0 };
      categoryTotals.set(category, {
        revenue: previous.revenue + log.direct_revenue + log.indirect_revenue,
        sampleCount: previous.sampleCount + 1,
      });
    }
  }
  const categoryRankings = [...categoryTotals.entries()]
    .map(([category, totals]) => ({
      category,
      revenue: totals.revenue,
      sample_count: totals.sampleCount,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const monthTotal = directTotal + indirectTotal;

  return {
    month_total: monthTotal,
    direct_total: directTotal,
    indirect_total: indirectTotal,
    goal_monthly: goalMonthly,
    progress_rate: goalMonthly === 0 ? 0 : Math.round((monthTotal / goalMonthly) * 100),
    top_content_title: top?.title ?? null,
    top_category: categoryRankings[0]?.category ?? null,
    top_content_revenue: top?.revenue ?? 0,
    category_rankings: categoryRankings,
  };
}
