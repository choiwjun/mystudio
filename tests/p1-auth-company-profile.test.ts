import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as sessionGET } from "@/app/api/auth/session/route";
import { withApiErrorLogging } from "@/lib/api/handler";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { readSessionFromRequest, singleUserCsrfToken } from "@/lib/auth/session";
import { isCompanyProfileComplete, serializeCompanyProfile } from "@/lib/company-profile/service";
import * as errorLogger from "@/lib/logging/errorLogger";
import { proxy } from "@/proxy";

const trdSource = readFileSync("docs/planning/02-trd.md", "utf8");
const tasksSource = readFileSync("docs/planning/06-tasks.md", "utf8");
const resourcesSource = readFileSync("specs/domain/resources.yaml", "utf8");
const codingConventionSource = readFileSync("docs/planning/07-coding-convention.md", "utf8");

beforeEach(() => {
  process.env["OWNER_EMAIL"] = "owner@example.com";
  process.env["ERROR_LOG_ENABLED"] = "false";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("P1 single-user no-login access", () => {
  it("keeps planning docs aligned with no-login single-owner access", () => {
    for (const source of [resourcesSource, trdSource, tasksSource]) {
      expect(source).toContain("single_owner_no_login");
      expect(source).toContain("CSRF");
      expect(source).toContain("withAuthenticatedApi");
      expect(source).toContain("proxy");
      expect(source).not.toContain("NextAuth.js");
      expect(source).not.toContain("JWT 토큰 발급");
      expect(source).not.toContain("Bearer token 또는");
      expect(source).not.toContain("Bearer Token 및");
    }

    expect(resourcesSource).toContain("login_required: false");
    expect(tasksSource).toContain("로그인 화면 없이 단일 Owner 세션을 자동 제공");
    expect(codingConventionSource).toContain("single-user no-login");
  });

  it("returns a single-owner session and csrf metadata without credentials", async () => {
    const response = await sessionGET(new NextRequest("http://localhost/api/auth/session"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      user: {
        email: "owner@example.com",
        name: "Owner",
      },
      csrf_token: singleUserCsrfToken,
      expires_at: "9999-12-31T23:59:59.000Z",
    });
  });

  it("keeps login POST as a compatibility no-op without issuing cookies", async () => {
    const response = await loginPOST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "ignored@example.com", password: "ignored" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("authorization")).toBeNull();
    expect(payload.data.csrf_token).toBe(singleUserCsrfToken);
    expect(JSON.stringify(payload.data)).not.toContain("Bearer");
  });

  it("always reads the local owner session from requests without requiring cookies", async () => {
    await expect(
      readSessionFromRequest(new Request("http://localhost/api/auth/session")),
    ).resolves.toMatchObject({
      email: "owner@example.com",
      csrfToken: singleUserCsrfToken,
    });
  });

  it("passes page and API requests through middleware without login redirects", async () => {
    const apiResponse = await proxy(new NextRequest("http://localhost/api/company-profile"));
    const pageResponse = await proxy(new NextRequest("http://localhost/products"));
    const bearerResponse = await proxy(
      new NextRequest("http://localhost/api/company-profile", {
        headers: { authorization: "Bearer stale-token" },
      }),
    );

    expect(apiResponse.status).toBe(200);
    expect(pageResponse.status).toBe(200);
    expect(bearerResponse.status).toBe(200);
    expect(apiResponse.headers.get("location")).toBeNull();
    expect(pageResponse.headers.get("location")).toBeNull();
  });

  it("does not write per-request error logs for session probes or proxy pass-through", async () => {
    process.env["ERROR_LOG_ENABLED"] = "true";
    const recordErrorLog = vi.spyOn(errorLogger, "recordErrorLog").mockResolvedValue(undefined);
    const malformedCookie = "paperclip_session=%E0%A4%A";

    const proxyResponse = await proxy(new NextRequest("http://localhost/api/company-profile"));
    const sessionResponse = await sessionGET(new NextRequest("http://localhost/api/auth/session"));
    const malformedSessionResponse = await sessionGET(
      new NextRequest("http://localhost/api/auth/session", {
        headers: { cookie: malformedCookie },
      }),
    );
    const guardedResponse = await withAuthenticatedApi("test.get", () =>
      Response.json({ ok: true }),
    )(new NextRequest("http://localhost/api/private.v1"));

    expect(proxyResponse.status).toBe(200);
    expect(sessionResponse.status).toBe(200);
    expect(malformedSessionResponse.status).toBe(200);
    expect(guardedResponse.status).toBe(200);
    expect(recordErrorLog).not.toHaveBeenCalled();
  });

  it("skips database-backed error logs when DATABASE_URL is absent", async () => {
    const previousDatabaseUrl = process.env["DATABASE_URL"];
    process.env["ERROR_LOG_ENABLED"] = "true";
    delete process.env["DATABASE_URL"];

    try {
      await expect(
        errorLogger.recordErrorLog({
          errorCode: "TEST_ERROR",
          message: "boom",
          severity: "high",
        }),
      ).resolves.toBeUndefined();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = previousDatabaseUrl;
      }
    }
  });

  it("correlates API error logs with the response request id", async () => {
    process.env["ERROR_LOG_ENABLED"] = "true";
    const recordErrorLog = vi.spyOn(errorLogger, "recordErrorLog").mockResolvedValue(undefined);
    const handler = withApiErrorLogging("test.throw", () => {
      throw new Error("boom");
    });

    const response = await handler(new NextRequest("http://localhost/api/private.v1"));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe(payload.request_id);
    expect(recordErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          request_id: payload.request_id,
          routeName: "test.throw",
        }),
      }),
    );
  });

  it("returns a dev-safe HQ fallback instead of an empty 500 when DATABASE_URL is absent", async () => {
    const previousDatabaseUrl = process.env["DATABASE_URL"];

    process.env["ERROR_LOG_ENABLED"] = "true";

    delete process.env["DATABASE_URL"];
    const recordErrorLog = vi.spyOn(errorLogger, "recordErrorLog").mockResolvedValue(undefined);
    const handler = withApiErrorLogging("hq.today", () => {
      throw new Error("Environment variable not found: DATABASE_URL.");
    });

    try {
      const response = await handler(new NextRequest("http://localhost/api/hq/today"));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("x-dev-database-fallback")).toBe("missing-database-url");
      expect(payload.success).toBe(true);
      expect(payload.data.hq_status).toMatchObject({
        status: "Good",
        pending_approvals: 0,
        compliance_failures: 0,
        needs_performance_log: 0,
      });
      expect(payload.data.hq_status.reason).toContain("DATABASE_URL");
      expect(payload.data.content_packages).toEqual([]);
      expect(payload.data.opportunity_memos).toEqual([]);
      expect(payload.data.revenue_summary).toMatchObject({
        month_total: 0,
        direct_total: 0,
        indirect_total: 0,
        goal_monthly: 500_000,
      });
      expect(payload.data.winning_patterns).toMatchObject({
        hook_type_stats: [],
        top_product_categories: [],
        refresh_candidates: {
          stale_products_count: 0,
          stale_links_count: 0,
          stale_products: [],
          stale_links: [],
        },
      });
      expect(payload.data.refresh_needed).toEqual(payload.data.winning_patterns.refresh_candidates);
      expect(recordErrorLog).not.toHaveBeenCalled();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = previousDatabaseUrl;
      }
    }
  });

  it("returns a clear 503 for database-backed POST actions when DATABASE_URL is absent", async () => {
    const previousDatabaseUrl = process.env["DATABASE_URL"];
    process.env["ERROR_LOG_ENABLED"] = "true";
    delete process.env["DATABASE_URL"];
    const recordErrorLog = vi.spyOn(errorLogger, "recordErrorLog").mockResolvedValue(undefined);
    const handler = withApiErrorLogging("hq.daily-briefing", () => {
      throw new Error("Environment variable not found: DATABASE_URL.");
    });

    try {
      const response = await handler(
        new NextRequest("http://localhost/api/hq/daily-briefing", { method: "POST" }),
      );
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get("x-dev-database-fallback")).toBe("missing-database-url");
      expect(payload.success).toBe(false);
      expect(payload.error).toMatchObject({
        code: "DATABASE_URL_REQUIRED",
        message: "DATABASE_URL is required for database-backed actions.",
      });
      expect(recordErrorLog).not.toHaveBeenCalled();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = previousDatabaseUrl;
      }
    }
  });

  it("still requires csrf for state-changing API handlers", async () => {
    const handler = withAuthenticatedApi("test.patch", () => Response.json({ ok: true }));
    const missingCsrfResponse = await handler(
      new NextRequest("http://localhost/api/company-profile", { method: "PATCH" }),
    );
    const missingPayload = await missingCsrfResponse.json();
    const validCsrfResponse = await handler(
      new NextRequest("http://localhost/api/company-profile", {
        method: "PATCH",
        headers: { "x-csrf-token": singleUserCsrfToken },
      }),
    );

    expect(missingCsrfResponse.status).toBe(403);
    expect(missingPayload.error.code).toBe("CSRF_TOKEN_INVALID");
    expect(validCsrfResponse.status).toBe(200);
  });
});

describe("P1 company profile contract", () => {
  it("marks Hermes and Content setup as incomplete until name and one category exist", () => {
    expect(isCompanyProfileComplete({ companyName: "", primaryCategories: ["자취"] })).toBe(false);
    expect(isCompanyProfileComplete({ companyName: "Paperclip", primaryCategories: [] })).toBe(
      false,
    );
    expect(
      isCompanyProfileComplete({ companyName: "Paperclip", primaryCategories: ["자취"] }),
    ).toBe(true);
  });

  it("serializes company_profile in the resource contract shape", () => {
    const serialized = serializeCompanyProfile({
      id: "profile_1",
      workspaceId: "default_workspace",
      companyName: "Paperclip",
      primaryCategories: ["자취"],
      blockedCategories: ["의료"],
      toneRules: "신뢰감 있게",
      contentPrinciples: "출처 명시",
      revenueGoalMonthly: 500000,
      createdAt: new Date("2026-07-05T00:00:00.000Z"),
      updatedAt: new Date("2026-07-05T01:00:00.000Z"),
    });

    expect(serialized).toEqual({
      id: "profile_1",
      company_name: "Paperclip",
      primary_categories: ["자취"],
      blocked_categories: ["의료"],
      tone_rules: "신뢰감 있게",
      content_principles: "출처 명시",
      revenue_goal_monthly: 500000,
      updated_at: "2026-07-05T01:00:00.000Z",
      setup_required: false,
    });
  });
});
