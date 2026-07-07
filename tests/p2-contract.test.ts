import { readFileSync } from "node:fs";
import { DecisionValue } from "@prisma/client";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GET as getHermesScan, POST as postHermesScan } from "@/app/api/hermes/scan/route";
import { decisionCreateSchema } from "@/lib/decisions/service";
import { collectHermesRawItems, NaverCredentialsMissingError } from "@/lib/hermes/rawItems";
import {
  buildKeywordClusters,
  buildRawItemInputs,
  filterBlockedCategories,
} from "@/lib/hermes/service";
import {
  NaverApiResponseError,
  NaverClient,
  NaverClientConfigurationError,
  type NaverRequesterOptions,
  shouldRunNaverLiveSmoke,
} from "@/lib/naver/client";
import {
  isOlderThanSevenDays,
  productCreateSchema,
  shoppingConnectLinkCreateSchema,
  shoppingConnectLinkPatchSchema,
} from "@/lib/products/service";
import { verifyCronSecret } from "@/lib/security/cron";
import { proxy } from "@/proxy";

const vercelConfigSchema = z.object({
  crons: z
    .array(
      z.object({
        path: z.string(),
        schedule: z.string(),
      }),
    )
    .optional(),
});

const vercelConfig = vercelConfigSchema.parse(JSON.parse(readFileSync("vercel.json", "utf8")));
const prismaSchema = readFileSync("prisma/schema.prisma", "utf8");
const hermesServiceSource = readFileSync("lib/hermes/service.ts", "utf8");
const hermesRawItemsSource = readFileSync("lib/hermes/rawItems.ts", "utf8");
const productManagerSource = readFileSync("components/products/ProductManager.tsx", "utf8");
const productTablesSource = readFileSync("components/products/ProductTables.tsx", "utf8");
const productServiceSource = readFileSync("lib/products/service.ts", "utf8");

async function withCronSecret<T>(secret: string, action: () => Promise<T>): Promise<T> {
  const previousSecret = process.env["CRON_SECRET"];
  process.env["CRON_SECRET"] = secret;
  try {
    return await action();
  } finally {
    if (previousSecret === undefined) {
      delete process.env["CRON_SECRET"];
    } else {
      process.env["CRON_SECRET"] = previousSecret;
    }
  }
}

async function withoutNaverCredentials<T>(action: () => Promise<T>): Promise<T> {
  const previousClientId = process.env["NAVER_CLIENT_ID"];
  const previousClientSecret = process.env["NAVER_CLIENT_SECRET"];
  delete process.env["NAVER_CLIENT_ID"];
  delete process.env["NAVER_CLIENT_SECRET"];
  try {
    return await action();
  } finally {
    if (previousClientId === undefined) {
      delete process.env["NAVER_CLIENT_ID"];
    } else {
      process.env["NAVER_CLIENT_ID"] = previousClientId;
    }
    if (previousClientSecret === undefined) {
      delete process.env["NAVER_CLIENT_SECRET"];
    } else {
      process.env["NAVER_CLIENT_SECRET"] = previousClientSecret;
    }
  }
}

describe("P2 Hermes contract", () => {
  it("registers the daily 06:00 KST Hermes scan with Vercel Cron", () => {
    expect(vercelConfig.crons).toContainEqual({
      path: "/api/hermes/scan",
      schedule: "0 21 * * *",
    });
  });

  it("rejects unauthenticated Hermes scan calls without a cron secret header", async () => {
    const response = await postHermesScan(
      new NextRequest("https://paperclip.local/api/hermes/scan", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("accepts Vercel Cron bearer credentials in the cron guard", async () => {
    await withCronSecret("expected-secret", async () => {
      const guard = verifyCronSecret(
        new Headers({ authorization: "Bearer expected-secret" }),
        process.env["CRON_SECRET"],
      );

      expect(guard.allowed).toBe(true);
    });
  });

  it("rejects invalid Vercel Cron GET bearer credentials at the route", async () => {
    const response = await withCronSecret(
      "expected-secret",
      async () =>
        await getHermesScan(
          new NextRequest("https://paperclip.local/api/hermes/scan", {
            method: "GET",
            headers: { authorization: "Bearer wrong-secret" },
          }),
        ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("lets Hermes cron credential attempts reach the route while protecting unauthenticated API traffic", async () => {
    const bearerAttempt = await proxy(
      new NextRequest("https://paperclip.local/api/hermes/scan", {
        method: "GET",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    const legacyAttempt = await proxy(
      new NextRequest("https://paperclip.local/api/hermes/scan", {
        method: "POST",
        headers: { "x-cron-secret": "wrong-secret" },
      }),
    );
    const unauthenticatedApi = await proxy(
      new NextRequest("https://paperclip.local/api/hermes/scan", { method: "POST" }),
    );

    expect(bearerAttempt.headers.get("x-middleware-next")).toBe("1");
    expect(legacyAttempt.headers.get("x-middleware-next")).toBe("1");
    expect(unauthenticatedApi.status).toBe(401);
  });

  it("rejects Hermes cron calls when the cron secret header does not match", async () => {
    const response = await withCronSecret(
      "expected-secret",
      async () =>
        await postHermesScan(
          new NextRequest("https://paperclip.local/api/hermes/scan", {
            method: "POST",
            headers: { "x-cron-secret": "wrong-secret" },
          }),
        ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("uses trigger execution id as the Hermes scan idempotency key", () => {
    expect(prismaSchema).toMatch(
      /triggerExecutionId\s+String\?\s+@unique\s+@map\("trigger_execution_id"\)/,
    );
    expect(hermesServiceSource).toContain("triggerExecutionId: idempotencyKey");
    expect(hermesServiceSource).toContain("createHermesRunLock");
    expect(hermesServiceSource).toContain("isUniqueConstraintViolation");
  });

  it("filters blocked categories before memo creation", () => {
    expect(filterBlockedCategories(["자취", "건강", "청소"], ["건강", "투자"])).toEqual([
      "자취",
      "청소",
    ]);
  });

  it("builds five keyword clusters with resource fields", () => {
    const clusters = buildKeywordClusters("장마철 자취방 습기");

    expect(clusters).toHaveLength(5);
    expect(clusters[0]).toMatchObject({
      primary_keyword: "장마철 자취방 습기 1",
      related_keywords: [
        "장마철 자취방 습기 추천",
        "장마철 자취방 습기 가격",
        "장마철 자취방 습기 후기",
      ],
      search_volume: 1200,
      competition_score: 35,
    });
  });

  it("maps Naver search results into expiring raw item inputs", () => {
    const collectedAt = new Date("2026-07-05T00:00:00.000Z");
    const rawItems = buildRawItemInputs({
      itemType: "naver_blog",
      query: "장마철 자취방 습기",
      collectedAt,
      items: [
        {
          title: "자취방 습기 관리",
          link: "https://blog.naver.com/paperclip/1",
          description: "장마철 습기 관리 체크리스트",
        },
      ],
    });

    expect(rawItems).toEqual([
      {
        itemType: "naver_blog",
        title: "자취방 습기 관리",
        url: "https://blog.naver.com/paperclip/1",
        content: "장마철 습기 관리 체크리스트",
        metadata: {
          query: "장마철 자취방 습기",
          source: "naver_api",
          itemType: "naver_blog",
        },
        collectedAt,
        expiresAt: new Date("2026-07-12T00:00:00.000Z"),
      },
    ]);
  });

  it("maps official Naver blog and shopping API responses through separated endpoints", async () => {
    const calls: Array<{
      readonly endpoint: string;
      readonly options: NaverRequesterOptions;
    }> = [];
    const client = new NaverClient(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        blogSearchUrl: "https://openapi.naver.test/v1/search/blog.json",
        shoppingSearchUrl: "https://openapi.naver.test/v1/search/shop.json",
        timeoutMs: 1234,
      },
      async (endpoint, options) => {
        calls.push({ endpoint, options });
        return {
          items: [
            {
              title: endpoint.includes("blog") ? "블로그 결과" : "쇼핑 결과",
              link: endpoint.includes("blog")
                ? "https://blog.naver.com/paperclip/1"
                : "https://shopping.naver.com/products/1",
              description: endpoint.includes("blog") ? "공식 블로그 매핑" : "공식 쇼핑 매핑",
            },
          ],
        };
      },
    );

    await expect(client.searchBlog("장마철 자취방 습기")).resolves.toEqual([
      {
        title: "블로그 결과",
        link: "https://blog.naver.com/paperclip/1",
        description: "공식 블로그 매핑",
      },
    ]);
    await expect(client.searchShopping("장마철 자취방 습기")).resolves.toEqual([
      {
        title: "쇼핑 결과",
        link: "https://shopping.naver.com/products/1",
        description: "공식 쇼핑 매핑",
      },
    ]);

    expect(calls.map((call) => call.endpoint)).toEqual([
      "https://openapi.naver.test/v1/search/blog.json",
      "https://openapi.naver.test/v1/search/shop.json",
    ]);
    expect(calls.map((call) => call.options.searchParams)).toEqual([
      { query: "장마철 자취방 습기", display: "10" },
      { query: "장마철 자취방 습기", display: "10" },
    ]);
    expect(calls.every((call) => call.options.timeout === 1234)).toBe(true);
    expect(calls.every((call) => call.options.retry.limit === 1)).toBe(true);
    expect(calls.every((call) => call.options.headers["X-Naver-Client-Id"] === "client-id")).toBe(
      true,
    );
    expect(
      calls.every((call) => call.options.headers["X-Naver-Client-Secret"] === "client-secret"),
    ).toBe(true);
  });

  it("fails closed on malformed official Naver API responses with sanitized errors", async () => {
    const client = new NaverClient(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        blogSearchUrl: "https://openapi.naver.test/v1/search/blog.json",
        shoppingSearchUrl: "https://openapi.naver.test/v1/search/shop.json",
        timeoutMs: 1234,
      },
      async () => ({ items: [{ title: "bad", link: "not-a-url" }] }),
    );

    await expect(client.searchBlog("장마철 자취방 습기")).rejects.toBeInstanceOf(
      NaverApiResponseError,
    );
    await expect(client.searchBlog("장마철 자취방 습기")).rejects.not.toThrow("client-secret");
    await expect(client.searchBlog("장마철 자취방 습기")).rejects.not.toThrow("not-a-url");
  });

  it("fails fast when NaverClient receives blank credentials", () => {
    expect(
      () =>
        new NaverClient({
          clientId: "",
          clientSecret: "client-secret",
          blogSearchUrl: "https://openapi.naver.test/v1/search/blog.json",
          shoppingSearchUrl: "https://openapi.naver.test/v1/search/shop.json",
          timeoutMs: 1234,
        }),
    ).toThrow(NaverClientConfigurationError);
    expect(
      () =>
        new NaverClient({
          clientId: "client-id",
          clientSecret: " ",
          blogSearchUrl: "https://openapi.naver.test/v1/search/blog.json",
          shoppingSearchUrl: "https://openapi.naver.test/v1/search/shop.json",
          timeoutMs: 1234,
        }),
    ).toThrow(NaverClientConfigurationError);
  });

  it("keeps live Naver smoke optional behind explicit credentials and RUN_NAVER_LIVE", () => {
    expect(shouldRunNaverLiveSmoke({})).toEqual({
      run: false,
      reason: "RUN_NAVER_LIVE is not 1.",
    });
    expect(shouldRunNaverLiveSmoke({ RUN_NAVER_LIVE: "1" })).toEqual({
      run: false,
      reason: "NAVER_CLIENT_ID is missing.",
    });
    expect(
      shouldRunNaverLiveSmoke({
        RUN_NAVER_LIVE: "1",
        NAVER_CLIENT_ID: "client-id",
      }),
    ).toEqual({
      run: false,
      reason: "NAVER_CLIENT_SECRET is missing.",
    });
    expect(
      shouldRunNaverLiveSmoke({
        RUN_NAVER_LIVE: "1",
        NAVER_CLIENT_ID: "client-id",
        NAVER_CLIENT_SECRET: "client-secret",
      }),
    ).toEqual({ run: true });
  });

  const liveSmokeGate = shouldRunNaverLiveSmoke();
  const runLiveSmoke = liveSmokeGate.run ? it : it.skip;
  runLiveSmoke("runs optional live Naver official API smoke when explicitly enabled", async () => {
    const client = new NaverClient({
      clientId: process.env["NAVER_CLIENT_ID"] ?? "",
      clientSecret: process.env["NAVER_CLIENT_SECRET"] ?? "",
      blogSearchUrl:
        process.env["NAVER_BLOG_SEARCH_URL"] ?? "https://openapi.naver.com/v1/search/blog.json",
      shoppingSearchUrl:
        process.env["NAVER_SHOPPING_SEARCH_URL"] ?? "https://openapi.naver.com/v1/search/shop.json",
      timeoutMs: 10_000,
    });

    const [blogItems, shoppingItems] = await Promise.all([
      client.searchBlog("자취방"),
      client.searchShopping("제습기"),
    ]);

    for (const items of [blogItems, shoppingItems]) {
      expect(items.length).toBeLessThanOrEqual(10);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(new URL(item.link).protocol).toMatch(/^https?:$/);
      }
    }
  });

  it("fails fast instead of falling back when Naver credentials are missing", async () => {
    await withoutNaverCredentials(async () => {
      await expect(collectHermesRawItems("장마철 자취방 습기")).rejects.toBeInstanceOf(
        NaverCredentialsMissingError,
      );
    });
  });

  it("does not retain internal or previous raw item fallback sources", () => {
    expect(hermesRawItemsSource).not.toContain("fallback_previous_raw_item");
    expect(hermesRawItemsSource).not.toContain("fallback_internal");
    expect(hermesRawItemsSource).not.toContain("internal:fallback");
  });

  it("does not convert failed locked scans into latest-memo successes", () => {
    expect(hermesServiceSource).toContain("HermesScanAlreadyStartedError");
    expect(hermesServiceSource).toContain('status: "failed"');
    expect(hermesServiceSource).not.toContain(
      "opportunityMemos: await findLatestOpportunityMemos(),\n        budgetBlockedAfterPartial: false",
    );
  });
});

describe("P2 decision contract", () => {
  it("accepts only selected, on_hold, rejected decisions", () => {
    expect(
      decisionCreateSchema.parse({
        opportunity_memo_id: "memo_1",
        decision: DecisionValue.selected,
      }),
    ).toEqual({
      opportunity_memo_id: "memo_1",
      decision: "selected",
    });
    expect(() =>
      decisionCreateSchema.parse({ opportunity_memo_id: "memo_1", decision: "approve" }),
    ).toThrow();
  });
});

describe("P2 products contract", () => {
  it("marks price checks older than seven days as stale", () => {
    const now = new Date("2026-07-05T00:00:00.000Z");
    expect(isOlderThanSevenDays(new Date("2026-06-27T23:59:59.000Z"), now)).toBe(true);
    expect(isOlderThanSevenDays(new Date("2026-07-01T00:00:00.000Z"), now)).toBe(false);
    expect(isOlderThanSevenDays(null, now)).toBe(true);
  });

  it("delegates Naver Shopping URL import to the pinned insane-search worker path", () => {
    expect(productServiceSource).toContain("importProductWithInsaneSearch(validatedUrl.url)");
    expect(productServiceSource).toContain("new ProductImportBlockedError(crawlerResult.reason");
    expect(productServiceSource).not.toContain("parseNaverProductFromUrl");
    expect(productServiceSource).not.toContain("missing_product_metadata");
  });

  it("validates manual products and shopping connect links", () => {
    expect(
      productCreateSchema.parse({
        product_name: "소형 제습기",
        price: 59000,
        category: "자취",
      }),
    ).toMatchObject({ product_name: "소형 제습기", price: 59000 });

    expect(
      shoppingConnectLinkCreateSchema.parse({
        product_id: "product_1",
        shopping_connect_url: "https://shopping.naver.com/ns/products/1",
        commission_rate: 3.5,
      }),
    ).toMatchObject({ product_id: "product_1", commission_rate: 3.5 });
  });

  it("accepts explicit shopping link freshness and active-state management", () => {
    expect(
      shoppingConnectLinkPatchSchema.parse({
        mark_checked: true,
      }),
    ).toEqual({ mark_checked: true });
    expect(
      shoppingConnectLinkPatchSchema.parse({
        content_package_id: null,
        is_active: false,
      }),
    ).toEqual({ content_package_id: null, is_active: false });
  });

  it("loads stale shopping links into the products refresh-needed tab", () => {
    expect(productManagerSource).toContain('fetch("/api/shopping-connect-links?stale=true")');
    expect(productManagerSource).toContain("confirmShoppingConnectLink");
    expect(productTablesSource).toContain("갱신 필요 링크");
  });
});
