import type { NextRequest } from "next/server";
import { createRequestId, fail, ok, runWithRequestId } from "@/lib/api/response";
import { canUseMissingDatabaseFallback } from "@/lib/db";
import { recordApiRequestLog } from "@/lib/logging/apiRequestLogger";
import { recordErrorLog } from "@/lib/logging/errorLogger";

export type ApiRouteHandler = (request: NextRequest) => Promise<Response> | Response;

const devDatabaseFallbackHeader = "x-dev-database-fallback";
const missingDatabaseUrlFallback = "missing-database-url";

function resolveAiBudgetCapUsd(): number {
  const capUsd = Number(process.env["DAILY_AI_COST_CAP_USD"] ?? "5");
  return Number.isFinite(capUsd) && capUsd > 0 ? capUsd : 5;
}

function fallbackAiBudget() {
  const capUsd = resolveAiBudgetCapUsd();
  return {
    kind: "within_budget",
    totalCostUsd: 0,
    capUsd,
    usageRate: 0,
    remainingUsd: capUsd,
  };
}

function fallbackCompanyProfile() {
  return {
    id: "profile_dev_missing_database",
    company_name: "Paperclip",
    primary_categories: ["생활"],
    blocked_categories: [],
    tone_rules: "담백하고 근거 중심으로 설명",
    content_principles: "검증 가능한 정보와 실사용 맥락을 우선",
    revenue_goal_monthly: 500_000,
    updated_at: new Date().toISOString(),
    setup_required: false,
  };
}

function fallbackHqStatus() {
  return {
    status: "Good",
    reason: "DATABASE_URL 미설정 상태라 개발용 빈 데이터를 표시합니다.",
    pending_approvals: 0,
    compliance_failures: 0,
    needs_performance_log: 0,
    ai_budget: fallbackAiBudget(),
  };
}

function fallbackRevenueSummary() {
  return {
    month_total: 0,
    direct_total: 0,
    indirect_total: 0,
    goal_monthly: 500_000,
    progress_rate: 0,
    top_content_title: null,
    top_content_revenue: 0,
    top_category: null,
    category_rankings: [],
  };
}

function fallbackWinningPatterns() {
  return {
    hook_type_stats: [],
    top_product_categories: [],
    refresh_candidates: {
      stale_products_count: 0,
      stale_links_count: 0,
      stale_products: [],
      stale_links: [],
    },
  };
}

function fallbackPerformanceLogs() {
  return {
    performance_logs: [],
    recent_content_packages: [],
    summary: {
      average_views: 0,
      average_clicks: 0,
      average_revenue: 0,
      best_hook_type: null,
    },
  };
}

function fallbackReportInsight() {
  return {
    title: "데이터 학습 중",
    detail: "성과와 수익 기록이 쌓이면 자동으로 리포트 판단을 제공합니다.",
    action: "발행 후 조회, 클릭, 직접 수익을 먼저 기록하세요.",
  };
}

function fallbackReportIntelligence() {
  return {
    revenue: fallbackRevenueSummary(),
    performance: fallbackPerformanceLogs(),
    weekly_review: fallbackReportInsight(),
    monthly_pnl: fallbackReportInsight(),
    next_month_calendar: [],
    paperclip_strategy: [],
    product_revenue_dashboard: [],
    content_roi: [],
    rewrite_recommendations: [],
    link_refresh_recommendations: [],
  };
}

function fallbackHqToday() {
  const winningPatterns = fallbackWinningPatterns();
  return {
    hq_status: fallbackHqStatus(),
    hq_briefing: null,
    opportunity_memos: [],
    content_packages: [],
    revenue_summary: fallbackRevenueSummary(),
    winning_patterns: winningPatterns,
    refresh_needed: winningPatterns.refresh_candidates,
  };
}

function withMissingDatabaseHeader(response: Response): Response {
  response.headers.set(devDatabaseFallbackHeader, missingDatabaseUrlFallback);
  return response;
}

function createMissingDatabaseFallbackResponse(
  request: NextRequest,
  error: unknown,
): Response | null {
  if (!canUseMissingDatabaseFallback(error)) {
    return null;
  }

  const init = {
    headers: { [devDatabaseFallbackHeader]: missingDatabaseUrlFallback },
  } satisfies ResponseInit;

  if (request.method === "GET") {
    switch (request.nextUrl.pathname) {
      case "/api/company-profile":
        return ok(fallbackCompanyProfile(), init);
      case "/api/hq/status":
        return ok(fallbackHqStatus(), init);
      case "/api/hq/today":
        return ok(fallbackHqToday(), init);
      case "/api/hermes/opportunity-memos":
        return ok({ opportunity_memos: [] }, init);
      case "/api/content-packages":
        return ok({ content_packages: [] }, init);
      case "/api/products":
        return ok({ products: [] }, init);
      case "/api/shopping-connect-links":
        return ok({ shopping_connect_links: [] }, init);
      case "/api/performance-logs":
        return ok(fallbackPerformanceLogs(), init);
      case "/api/memory/winning-patterns":
        return ok(fallbackWinningPatterns(), init);
      case "/api/revenue/summary":
      case "/api/shopping-connect/revenue-summary":
        return ok(fallbackRevenueSummary(), init);
      case "/api/reports/intelligence":
        return ok(fallbackReportIntelligence(), init);
    }
  }

  return withMissingDatabaseHeader(
    fail(
      {
        code: "DATABASE_URL_REQUIRED",
        message: "DATABASE_URL is required for database-backed actions.",
      },
      503,
    ),
  );
}

function attachResponseMetadata(
  response: Response,
  durationMs: number,
  requestId: string,
): Response {
  response.headers.set("x-response-time-ms", durationMs.toString());
  response.headers.set("x-request-id", requestId);
  return response;
}

async function recordApiResponse(input: {
  readonly routeName: string;
  readonly request: NextRequest;
  readonly response: Response;
  readonly requestId: string;
  readonly durationMs: number;
}): Promise<void> {
  try {
    await recordApiRequestLog({
      routeName: input.routeName,
      apiPath: input.request.nextUrl.pathname,
      method: input.request.method,
      statusCode: input.response.status,
      durationMs: input.durationMs,
      requestId: input.requestId,
      ...(input.response.status >= 400 ? { errorCode: `HTTP_${input.response.status}` } : {}),
    });
  } catch {}
}

async function recordUnhandledApiError(input: {
  readonly routeName: string;
  readonly request: NextRequest;
  readonly requestId: string;
  readonly error: unknown;
}): Promise<void> {
  const message = input.error instanceof Error ? input.error.message : "Unknown API error";
  const stackTrace = input.error instanceof Error ? input.error.stack : undefined;

  try {
    await recordErrorLog({
      errorCode: "UNHANDLED_API_ERROR",
      message,
      severity: "high",
      ...(stackTrace === undefined ? {} : { stackTrace }),
      context: {
        request_id: input.requestId,
        routeName: input.routeName,
        apiPath: input.request.nextUrl.pathname,
        method: input.request.method,
      },
    });
  } catch {}
}

export function withApiErrorLogging(routeName: string, handler: ApiRouteHandler): ApiRouteHandler {
  return async (request: NextRequest): Promise<Response> => {
    const requestId = createRequestId();
    return runWithRequestId(requestId, async () => {
      const startedAt = performance.now();
      try {
        const response = await handler(request);
        const durationMs = Math.round(performance.now() - startedAt);
        await recordApiResponse({ routeName, request, response, requestId, durationMs });
        return attachResponseMetadata(response, durationMs, requestId);
      } catch (error: unknown) {
        const fallbackResponse = createMissingDatabaseFallbackResponse(request, error);
        if (fallbackResponse !== null) {
          const durationMs = Math.round(performance.now() - startedAt);
          await recordApiResponse({
            routeName,
            request,
            response: fallbackResponse,
            requestId,
            durationMs,
          });
          return attachResponseMetadata(fallbackResponse, durationMs, requestId);
        }

        await recordUnhandledApiError({ routeName, request, requestId, error });

        const response = fail(
          {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected API error.",
          },
          500,
        );
        const durationMs = Math.round(performance.now() - startedAt);
        await recordApiResponse({ routeName, request, response, requestId, durationMs });
        return attachResponseMetadata(response, durationMs, requestId);
      }
    });
  };
}
