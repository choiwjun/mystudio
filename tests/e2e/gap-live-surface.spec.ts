import { expect, type Page, test } from "@playwright/test";
import { SignJWT } from "jose";

const host = "http://127.0.0.1:4173";
const csrfToken = "e2e-csrf-token";
const sessionSecret = "paperclip-e2e-secret";
const nowIso = "2026-07-07T00:00:00.000Z";

async function createSessionCookie(): Promise<string> {
  return new SignJWT({
    email: "owner@example.com",
    name: "Owner",
    csrfToken,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(sessionSecret));
}

async function authenticate(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: "paperclip_session",
      value: await createSessionCookie(),
      url: host,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    },
  ]);
}

function apiSuccess(data: unknown): Record<string, unknown> {
  return {
    success: true,
    data,
    error: null,
    timestamp: nowIso,
    request_id: "req_e2e",
  };
}

async function fulfillJson(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  data: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

async function mockCommonShellApis(page: Page): Promise<void> {
  await page.route("**/api/auth/session", async (route) => {
    await fulfillJson(route, apiSuccess({ csrf_token: csrfToken }));
  });
  await page.route("**/api/company-profile", async (route) => {
    await fulfillJson(
      route,
      apiSuccess({
        setup_required: false,
        profile: {
          id: "profile_1",
          company_name: "Paperclip",
          primary_categories: ["생활"],
          blocked_categories: [],
          tone_rules: "담백하게",
          content_principles: "근거 중심",
          revenue_goal_monthly: 500000,
        },
      }),
    );
  });
  await page.route("**/api/hq/status", async (route) => {
    await fulfillJson(
      route,
      apiSuccess({
        status: "Good",
        reason: "E2E mocked status",
        needs_performance_log: 0,
        ai_budget: {
          kind: "within_budget",
          totalCostUsd: 0,
          capUsd: 5,
          usageRate: 0,
          remainingUsd: 5,
        },
      }),
    );
  });
}

function productFixture(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "product_e2e",
    product_name: "모의 네이버 상품",
    product_url: "https://shopping.naver.com/products/1",
    source: "naver_shopping",
    price: 12900,
    price_checked_at: nowIso,
    image_url: null,
    category: "생활",
    popularity_score: null,
    popularity_rank: null,
    popularity_source: null,
    popularity_checked_at: null,
    memo: "insane-search e2e metadata",
    stale: false,
    created_at: nowIso,
    updated_at: nowIso,
    ...overrides,
  };
}

const packageSummary = {
  id: "pkg_kanban",
  topic: { title: "홈피드 기획안", description: "Kanban e2e" },
  status: "assigned",
  progress: 0.3,
  updated_at: nowIso,
};

function hqTodayPayload(): Record<string, unknown> {
  return {
    hq_status: {
      status: "Good",
      reason: "E2E mocked HQ status",
      pending_approvals: 0,
      compliance_failures: 0,
      needs_performance_log: 0,
      ai_budget: {
        kind: "within_budget",
        totalCostUsd: 0,
        capUsd: 5,
        usageRate: 0,
        remainingUsd: 5,
      },
    },
    hq_briefing: null,
    opportunity_memos: [],
    content_packages: [
      {
        ...packageSummary,
        paperclip_decision_id: "decision_kanban",
        drafts: [],
        title_candidates: [],
        compliance_checks: [],
        exports: [],
        products: [],
        shopping_connect_links: [],
      },
    ],
    revenue_summary: {
      month_total: 0,
      direct_total: 0,
      indirect_total: 0,
      goal_monthly: 500000,
      progress_rate: 0,
      top_content_title: null,
      top_content_revenue: 0,
    },
    winning_patterns: {
      patterns: [],
      refresh_candidates: [],
      category_focus: [],
    },
    refresh_needed: [],
  };
}

function mediumPackagePayload(dismissed = false): Record<string, unknown> {
  const issue = {
    id: "issue_medium",
    issue_type: "price_source",
    severity: "medium",
    message: "가격 출처 확인이 필요합니다.",
    suggested_fix: "가격 출처를 수동 확인하세요.",
    blocks_export: !dismissed,
    dismissed,
    dismissed_at: dismissed ? nowIso : null,
    dismissed_by: dismissed ? "owner" : null,
    dismiss_reason: dismissed ? "Owner verified the price source manually." : null,
    dismissal: dismissed
      ? {
          dismissed_at: nowIso,
          dismissed_by: "owner",
          reason: "Owner verified the price source manually.",
        }
      : null,
  };

  return {
    id: "pkg_medium",
    topic: { title: "중위험 검수 패키지", description: "Compliance e2e" },
    opportunity_memo: null,
    status: dismissed ? "owner_approval_required" : "compliance_failed",
    publish_readiness: "not_ready",
    progress: 0.65,
    paperclip_decision_id: "decision_medium",
    drafts: [
      {
        id: "draft_medium",
        channel: "naver_blog",
        homefeed_title: ["중위험 검수"],
        search_title: "중위험 검수",
        thumbnail_text: [],
        first_screen: "가격 출처 확인",
        body_markdown: "가격 출처 확인이 필요한 본문",
        comparison_table: null,
        faq: [],
        disclosure_text: null,
        price_notice: null,
        original_body: "가격 출처 확인이 필요한 본문",
        updated_at: nowIso,
        status: "draft",
      },
    ],
    compliance_checks: [
      {
        id: "check_medium",
        risk_level: "medium",
        pass: false,
        export_allowed: dismissed,
        checked_at: nowIso,
        issues: [issue],
      },
    ],
    title_candidates: [],
    products: [],
    shopping_connect_links: [],
    exports: [],
    updated_at: nowIso,
  };
}
function mediumComplianceCheckPayload(dismissed = false): Record<string, unknown> {
  const checks = mediumPackagePayload(dismissed)["compliance_checks"];
  return Array.isArray(checks) && checks[0] !== undefined && typeof checks[0] === "object"
    ? (checks[0] as Record<string, unknown>)
    : {};
}

test.describe("8-gap implemented app live-surface harness", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await mockCommonShellApis(page);
  });

  test("first-run settings keeps server/action fail-closed and redirects after CSRF PATCH", async ({
    page,
  }) => {
    await page.route("**/api/company-profile", async (route) => {
      const request = route.request();
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as {
          company_name?: string;
          primary_categories?: string[];
          blocked_categories?: string[];
          tone_rules?: string;
          content_principles?: string;
          revenue_goal_monthly?: number;
        };
        expect(request.headers()["authorization"]).toBeUndefined();
        expect(request.headers()["x-csrf-token"]).toBe(csrfToken);
        expect(body.company_name).toBe("Paperclip Studio");
        expect(body.primary_categories).toEqual(["생활", "청소"]);
        await fulfillJson(
          route,
          apiSuccess({
            id: "profile_1",
            company_name: body.company_name,
            primary_categories: body.primary_categories,
            blocked_categories: body.blocked_categories ?? [],
            tone_rules: body.tone_rules ?? "",
            content_principles: body.content_principles ?? "",
            revenue_goal_monthly: body.revenue_goal_monthly ?? 500000,
            updated_at: nowIso,
            setup_required: false,
          }),
        );
        return;
      }

      await fulfillJson(
        route,
        apiSuccess({
          id: "profile_1",
          company_name: "",
          primary_categories: [],
          blocked_categories: [],
          tone_rules: "",
          content_principles: "",
          revenue_goal_monthly: 500000,
          updated_at: nowIso,
          setup_required: true,
        }),
      );
    });
    await page.route("**/api/hq/today", async (route) => {
      await fulfillJson(route, apiSuccess(hqTodayPayload()));
    });
    await page.route("**/api/hermes/opportunity-memos", async (route) => {
      await fulfillJson(route, apiSuccess({ opportunity_memos: [] }));
    });

    await page.goto("/settings");
    await expect(page.getByLabel("초기 설정 필요")).toBeVisible();
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();

    await page.getByLabel("회사명").fill("Paperclip Studio");
    await page.getByLabel("주요 카테고리").fill("생활, 청소");
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
    await page.getByLabel("차단 카테고리").fill("건강, 의료");
    await page.getByLabel("톤 규칙").fill("담백하게");
    await page.getByLabel("콘텐츠 원칙").fill("근거 중심");
    await page.getByLabel("월 매출 목표").fill("700000");

    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page).toHaveURL(`${host}/?setup=complete`);
  });

  test("header exposes settings and sidebar renders Korean workflow navigation", async ({
    page,
  }) => {
    await page.route("**/api/products", async (route) => {
      await fulfillJson(route, apiSuccess({ products: [] }));
    });
    await page.route("**/api/shopping-connect-links**", async (route) => {
      await fulfillJson(route, apiSuccess({ shopping_connect_links: [] }));
    });
    await page.route("**/api/content-packages", async (route) => {
      await fulfillJson(route, apiSuccess({ content_packages: [] }));
    });
    await page.route("**/api/company-profile", async (route) => {
      await fulfillJson(
        route,
        apiSuccess({
          id: "profile_1",
          company_name: "Paperclip",
          primary_categories: ["생활"],
          blocked_categories: [],
          tone_rules: "담백하게",
          content_principles: "근거 중심",
          revenue_goal_monthly: 500000,
          updated_at: nowIso,
          setup_required: false,
        }),
      );
    });

    await page.goto("/products");
    const departments = page.getByRole("navigation", { name: "업무 메뉴" });
    for (const routeName of [
      "HQ 지휘실",
      "기회 발굴",
      "콘텐츠 제작",
      "블로그 콘텐츠",
      "SNS 변환",
      "제휴/어필리에이트 수익",
      "제휴 상품",
      "쇼핑커넥트 링크",
      "제휴 계정",
      "성과 기록",
      "일간 리포트",
      "주간 리포트",
      "월간 리포트",
      "컴플라이언스",
      "회사 메모리",
    ]) {
      await expect(departments.getByRole("link", { name: routeName })).toBeVisible();
    }
    await expect(departments.locator('a[href="/reports"]')).toBeVisible();

    await expect(departments.getByRole("link", { name: "설정" })).toHaveCount(0);
    for (const hiddenName of ["Content Factory", "Revenue Desk", "Reports"]) {
      await expect(departments.getByRole("link", { name: hiddenName, exact: true })).toHaveCount(0);
    }
    for (const hiddenPath of [
      "/hermes/keywords",
      "/hermes/competitors",
      "/compliance/policies",
      "/memory/patterns",
      "/packages/demo",
    ]) {
      await expect(departments.locator(`a[href="${hiddenPath}"]`)).toHaveCount(0);
    }

    await page.getByRole("link", { name: "설정" }).click();
    await expect(page).toHaveURL(`${host}/settings`);
    await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  });
  test("implemented products page reports import success and fail-closed manual fallback", async ({
    page,
  }) => {
    let importAttempt = 0;
    await page.route("**/api/products", async (route) => {
      await fulfillJson(route, apiSuccess({ products: [] }));
    });
    await page.route("**/api/shopping-connect-links**", async (route) => {
      await fulfillJson(route, apiSuccess({ shopping_connect_links: [] }));
    });
    await page.route("**/api/content-packages", async (route) => {
      await fulfillJson(route, apiSuccess({ content_packages: [] }));
    });
    await page.route("**/api/products/import", async (route) => {
      importAttempt += 1;
      if (importAttempt === 1) {
        await fulfillJson(route, apiSuccess(productFixture()));
        return;
      }
      await fulfillJson(
        route,
        {
          success: false,
          data: null,
          error: {
            code: "PRODUCT_IMPORT_BLOCKED",
            message: "This URL cannot be imported automatically. Use manual input.",
            details: { reason: "crawler_unavailable" },
          },
          timestamp: nowIso,
          request_id: "req_import_blocked",
        },
        422,
      );
    });

    await page.goto("/products");
    await page.getByRole("tab", { name: "새 상품" }).click();
    await page.getByLabel("네이버 쇼핑 URL").fill("https://shopping.naver.com/products/1");
    await page.getByRole("button", { name: "URL 정보 가져오기" }).click();
    await expect(page.getByText("추가됨")).toBeVisible();

    await page.getByRole("button", { name: "URL 정보 가져오기" }).click();
    await expect(page.getByText("수동 입력으로 등록하세요", { exact: true })).toBeVisible();
    await page.screenshot({ path: "artifacts/g001-live-products.png", fullPage: true });
  });

  test("implemented content compliance page requires medium dismissal reason and renders audit", async ({
    page,
  }) => {
    await page.route("**/api/content-packages/pkg_medium", async (route) => {
      await fulfillJson(route, apiSuccess(mediumPackagePayload(false)));
    });
    await page.route("**/api/compliance/issues/issue_medium/dismiss", async (route) => {
      const body = route.request().postDataJSON() as { dismiss_reason?: string };
      expect(route.request().headers()["x-csrf-token"]).toBe(csrfToken);
      expect(body.dismiss_reason).toBe("Owner verified the price source manually.");
      await fulfillJson(
        route,
        apiSuccess({
          issue: {
            id: "issue_medium",
            dismissed_at: nowIso,
            dismissed_by: "owner",
            dismiss_reason: body.dismiss_reason,
            dismissal: {
              dismissed_at: nowIso,
              dismissed_by: "owner",
              reason: body.dismiss_reason,
            },
          },
          compliance_check: mediumComplianceCheckPayload(true),
        }),
      );
    });
    await page.route("**/api/drafts/draft_medium", async (route) => {
      const drafts = mediumPackagePayload(false)["drafts"];
      await fulfillJson(route, apiSuccess(Array.isArray(drafts) ? drafts[0] : {}));
    });

    await page.goto("/packages/pkg_medium");
    await page.getByRole("tab", { name: "검수" }).click();
    await page.getByRole("button", { name: "사유 입력 후 무시" }).click();
    await expect(
      page.getByText("중위험 이슈는 담당자 사유를 입력해야 무시할 수 있습니다."),
    ).toBeVisible();
    await page.getByLabel("중위험 무시 사유").fill("Owner verified the price source manually.");
    await page.getByRole("button", { name: "사유 입력 후 무시" }).click();
    await expect(page.getByText("사유: Owner verified the price source manually.")).toBeVisible();
    await page.screenshot({ path: "artifacts/g001-live-compliance.png", fullPage: true });
  });

  test("implemented HQ kanban drag invokes compliance side effect and displays returned status", async ({
    page,
  }) => {
    await page.route("**/api/hq/today", async (route) => {
      await fulfillJson(route, apiSuccess(hqTodayPayload()));
    });
    await page.route("**/api/hermes/opportunity-memos", async (route) => {
      await fulfillJson(route, apiSuccess({ opportunity_memos: [] }));
    });
    await page.route("**/api/company-profile", async (route) => {
      await fulfillJson(
        route,
        apiSuccess({
          id: "profile_1",
          company_name: "Paperclip",
          primary_categories: ["생활"],
          blocked_categories: [],
          tone_rules: "담백하게",
          content_principles: "근거 중심",
          revenue_goal_monthly: 500000,
        }),
      );
    });
    await page.route("**/api/content-packages/pkg_kanban", async (route) => {
      const body = route.request().postDataJSON() as { status?: string; reason?: string };
      expect(route.request().headers()["x-csrf-token"]).toBe(csrfToken);
      expect(body).toEqual({ status: "compliance_checked", reason: "HQ kanban drag update" });
      await fulfillJson(
        route,
        apiSuccess({
          ...packageSummary,
          status: "owner_approval_required",
          progress: 0.75,
          updated_at: nowIso,
        }),
      );
    });

    await page.goto("/");
    await expect(page.getByLabel("Content package status kanban")).toBeVisible();
    const card = page.getByRole("link", { name: /홈피드 기획안/ });
    await expect(card).toContainText("배정됨");
    await card.dragTo(page.getByLabel("검수중"));
    await expect(page.getByText("상태가 승인 필요로 업데이트되었습니다.")).toBeVisible();
    await expect(
      page.getByLabel("검수중").getByRole("link", { name: /홈피드 기획안/ }),
    ).toContainText("승인 필요");
    await page.screenshot({ path: "artifacts/g001-live-kanban.png", fullPage: true });
  });
});
