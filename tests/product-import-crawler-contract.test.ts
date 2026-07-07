import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const createMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      create: createMock,
    },
  },
}));

import {
  insaneSearchLicense,
  insaneSearchPinnedRef,
  insaneSearchUpstream,
  resetInsaneSearchWorkerForTest,
  setInsaneSearchWorkerForTest,
} from "@/lib/products/insaneSearch";
import { importProduct } from "@/lib/products/service";

const mockedLookup = vi.mocked(lookup);

function mockPublicDns(): void {
  mockedLookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never);
}

function mockCreatedProduct(input: {
  readonly productName: string;
  readonly productUrl: string;
  readonly source: string;
  readonly price?: number;
  readonly imageUrl?: string;
  readonly category?: string;
  readonly memo?: string;
}) {
  return {
    id: "product_1",
    productName: input.productName,
    productUrl: input.productUrl,
    source: input.source,
    price: input.price ?? null,
    priceCheckedAt: input.price === undefined ? null : new Date("2026-07-07T00:00:00.000Z"),
    imageUrl: input.imageUrl ?? null,
    category: input.category ?? null,
    memo: input.memo ?? null,
    createdAt: new Date("2026-07-07T00:00:00.000Z"),
    updatedAt: new Date("2026-07-07T00:00:00.000Z"),
  };
}

describe("product import insane-search crawler contract", () => {
  beforeEach(() => {
    mockPublicDns();
    createMock.mockImplementation(({ data }) =>
      mockCreatedProduct({
        productName: data.productName,
        productUrl: data.productUrl,
        source: data.source,
        price: data.price,
        imageUrl: data.imageUrl,
        category: data.category,
        memo: data.memo,
      }),
    );
  });

  afterEach(() => {
    resetInsaneSearchWorkerForTest();
    delete process.env["INSANE_SEARCH_WORKER_URL"];
    delete process.env["INSANE_SEARCH_TIMEOUT_MS"];
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("pins the upstream insane-search worker contract metadata", () => {
    expect(insaneSearchUpstream).toBe("https://github.com/fivetaku/insane-search");
    expect(insaneSearchPinnedRef).toMatch(/^[0-9a-f]{40}$/);
    expect(insaneSearchLicense).toBe("MIT");
  });

  it("blocks an initial non-allowlisted URL before invoking the worker", async () => {
    const worker = vi.fn();
    setInsaneSearchWorkerForTest(worker);

    await expect(importProduct({ url: "https://example.com/item?q=desk" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:blocked_domain",
    );

    expect(worker).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("blocks a crawler redirect to a non-allowlisted public host", async () => {
    const worker = vi.fn().mockResolvedValue({
      metadata: { product_name: "Desk" },
      final_url: "https://shopping.naver.com/products/1",
      redirect_chain: [
        "https://search.shopping.naver.com/search/all?query=desk",
        "https://example.com/landing",
      ],
      trace_id: "trace_redirect",
    });
    setInsaneSearchWorkerForTest(worker);

    await expect(
      importProduct({ url: "https://search.shopping.naver.com/search/all?query=desk" }),
    ).rejects.toThrow("PRODUCT_IMPORT_BLOCKED:redirect_blocked");

    expect(worker).toHaveBeenCalledOnce();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates product input from an allowed final URL and bounded metadata", async () => {
    setInsaneSearchWorkerForTest(
      vi.fn().mockResolvedValue({
        metadata: {
          product_name: "  Standing Desk  ",
          price: "129,000원",
          image_url: "https://img.example.com/desk.png",
          category: "Home Office",
        },
        final_url: "https://shopping.naver.com/products/123?query=desk",
        redirect_chain: ["https://search.shopping.naver.com/search/all?query=desk"],
        trace_id: "trace_ok",
      }),
    );

    const imported = await importProduct({
      url: "https://search.shopping.naver.com/search/all?query=desk",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productName: "Standing Desk",
        productUrl: "https://shopping.naver.com/products/123?query=desk",
        source: "naver_shopping",
        price: 129000,
        imageUrl: "https://img.example.com/desk.png",
        category: "Home Office",
      }),
    });
    expect(imported).toMatchObject({
      product_name: "Standing Desk",
      product_url: "https://shopping.naver.com/products/123?query=desk",
      source: "naver_shopping",
      price: 129000,
    });
  });

  it("fails closed instead of persisting deterministic fallback data when the crawler is unavailable", async () => {
    setInsaneSearchWorkerForTest(vi.fn().mockResolvedValue(null));

    await expect(
      importProduct({
        url: "https://search.shopping.naver.com/search/all?query=desk&price=129000",
      }),
    ).rejects.toThrow("PRODUCT_IMPORT_BLOCKED:crawler_unavailable");

    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails closed when crawler metadata is missing or invalid", async () => {
    setInsaneSearchWorkerForTest(
      vi.fn().mockResolvedValue({
        metadata: { price: 129000 },
        final_url: "https://shopping.naver.com/products/123",
        redirect_chain: [],
      }),
    );

    await expect(importProduct({ url: "https://shopping.naver.com/products/123" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:metadata_missing",
    );

    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails closed when the worker omits redirect_chain", async () => {
    setInsaneSearchWorkerForTest(
      vi.fn().mockResolvedValue({
        metadata: { product_name: "Desk" },
        final_url: "https://shopping.naver.com/products/123",
      }),
    );

    await expect(importProduct({ url: "https://shopping.naver.com/products/123" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:invalid_response",
    );

    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails closed when the worker omits or changes the final URL to an unsafe target", async () => {
    setInsaneSearchWorkerForTest(
      vi.fn().mockResolvedValue({
        metadata: { product_name: "Desk" },
        redirect_chain: [],
      }),
    );

    await expect(importProduct({ url: "https://shopping.naver.com/products/123" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:final_url_uninspectable",
    );

    setInsaneSearchWorkerForTest(
      vi.fn().mockResolvedValue({
        metadata: { product_name: "Desk" },
        final_url: "https://example.com/products/123",
        redirect_chain: [],
      }),
    );

    await expect(importProduct({ url: "https://shopping.naver.com/products/123" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:blocked_domain",
    );

    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails closed when the worker final URL resolves to a private address", async () => {
    mockedLookup
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }] as never)
      .mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }] as never);
    setInsaneSearchWorkerForTest(
      vi.fn().mockResolvedValue({
        metadata: { product_name: "Desk" },
        final_url: "https://shopping.naver.com/products/123",
        redirect_chain: [],
      }),
    );

    await expect(importProduct({ url: "https://shopping.naver.com/products/123" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:private_ip",
    );

    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails closed when the default insane-search worker response exceeds the byte cap", async () => {
    process.env["INSANE_SEARCH_WORKER_URL"] = "https://worker.internal/import";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x".repeat(32_769), { status: 200 })),
    );

    await expect(importProduct({ url: "https://shopping.naver.com/products/123" })).rejects.toThrow(
      "PRODUCT_IMPORT_BLOCKED:invalid_response",
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://worker.internal/import",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-insane-search-upstream": insaneSearchUpstream,
          "x-insane-search-pinned-ref": insaneSearchPinnedRef,
          "x-insane-search-license": insaneSearchLicense,
        }),
      }),
    );
    expect(createMock).not.toHaveBeenCalled();
  });
});
