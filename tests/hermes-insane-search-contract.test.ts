import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInsaneSearchRawItems } from "@/lib/hermes/insaneSearchRawItemMapper";

const searchProviderSource = readFileSync("lib/hermes/searchProvider.ts", "utf8");
const insaneSearchRawItemsSource = readFileSync("lib/hermes/insaneSearchRawItems.ts", "utf8");
const hermesServiceSource = readFileSync("lib/hermes/service.ts", "utf8");

describe("Hermes insane-search default provider contract", () => {
  it("uses insane-search before the official Naver API fallback", () => {
    expect(searchProviderSource).toContain("collectInsaneSearchRawItems({ query, target })");
    expect(searchProviderSource).toContain(
      "insaneSearchItems ?? collectNaverRawItems(query, target)",
    );
    expect(hermesServiceSource).toContain(
      'import { collectHermesRawItems } from "@/lib/hermes/searchProvider"',
    );
  });

  it("sends Hermes search requests through the pinned insane-search worker contract", () => {
    expect(insaneSearchRawItemsSource).toContain('mode: "search"');
    expect(insaneSearchRawItemsSource).toContain('task: "hermes_search"');
    expect(insaneSearchRawItemsSource).toContain("INSANE_SEARCH_WORKER_URL");
    expect(insaneSearchRawItemsSource).toContain("x-insane-search-pinned-ref");
    expect(insaneSearchRawItemsSource).toContain("insaneSearchPinnedRef");
  });

  it("maps insane-search blog and shopping results into Hermes raw item inputs", () => {
    const collectedAt = new Date("2026-07-09T00:00:00.000Z");
    const rawItems = buildInsaneSearchRawItems({
      query: "장마철 자취방 습기",
      target: "all",
      collectedAt,
      response: {
        trace_id: "trace_1",
        blog_items: [
          {
            title: "<b>습기 제거</b> 체크리스트",
            link: "https://blog.naver.com/paperclip/1",
            description: "장마철 자취방 관리",
          },
        ],
        shopping_items: [
          {
            title: "소형 제습기",
            url: "https://shopping.naver.com/products/1",
            description: "가격 비교",
          },
        ],
      },
    });

    expect(rawItems).toEqual([
      {
        itemType: "naver_blog",
        title: "습기 제거 체크리스트",
        url: "https://blog.naver.com/paperclip/1",
        content: "장마철 자취방 관리",
        metadata: expect.objectContaining({
          query: "장마철 자취방 습기",
          source: "insane_search",
          target: "all",
          trace_id: "trace_1",
        }),
        collectedAt,
        expiresAt: new Date("2026-07-16T00:00:00.000Z"),
      },
      {
        itemType: "naver_shopping",
        title: "소형 제습기",
        url: "https://shopping.naver.com/products/1",
        content: "가격 비교",
        metadata: expect.objectContaining({
          source: "insane_search",
          itemType: "naver_shopping",
        }),
        collectedAt,
        expiresAt: new Date("2026-07-16T00:00:00.000Z"),
      },
    ]);
  });
});
