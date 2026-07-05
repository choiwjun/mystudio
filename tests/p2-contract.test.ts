import { readFileSync } from "node:fs";
import { DecisionValue } from "@prisma/client";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { POST as postHermesScan } from "@/app/api/hermes/scan/route";
import { decisionCreateSchema } from "@/lib/decisions/service";
import {
  buildKeywordClusters,
  buildRawItemInputs,
  filterBlockedCategories,
} from "@/lib/hermes/service";
import {
  isOlderThanSevenDays,
  parseNaverProductFromUrl,
  productCreateSchema,
  shoppingConnectLinkCreateSchema,
  shoppingConnectLinkPatchSchema,
} from "@/lib/products/service";

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
const productManagerSource = readFileSync("components/products/ProductManager.tsx", "utf8");
const productTablesSource = readFileSync("components/products/ProductTables.tsx", "utf8");

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
        },
        collectedAt,
        expiresAt: new Date("2026-07-12T00:00:00.000Z"),
      },
    ]);
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

  it("parses a Naver Shopping URL into importable product fields", () => {
    const parsed = parseNaverProductFromUrl(
      new URL("https://search.shopping.naver.com/search/all?query=%EC%A0%9C%EC%8A%B5%EA%B8%B0"),
    );

    expect(parsed).toMatchObject({
      product_name: "제습기",
      source: "naver_shopping",
      product_url: "https://search.shopping.naver.com/search/all?query=%EC%A0%9C%EC%8A%B5%EA%B8%B0",
    });
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

  it("accepts explicit shopping link freshness confirmation", () => {
    expect(
      shoppingConnectLinkPatchSchema.parse({
        mark_checked: true,
      }),
    ).toEqual({ mark_checked: true });
  });

  it("loads stale shopping links into the products refresh-needed tab", () => {
    expect(productManagerSource).toContain('fetch("/api/shopping-connect-links?stale=true")');
    expect(productManagerSource).toContain("confirmShoppingConnectLink");
    expect(productTablesSource).toContain("갱신 필요 링크");
  });
});
