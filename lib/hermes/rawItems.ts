import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordErrorLog } from "@/lib/logging/errorLogger";
import { NaverClient, type NaverClientConfig, type NaverSearchItem } from "@/lib/naver/client";

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
const defaultBlogSearchUrl = "https://openapi.naver.com/v1/search/blog.json";
const defaultShoppingSearchUrl = "https://openapi.naver.com/v1/search/shop.json";

export type RawItemInput = {
  readonly itemType: string;
  readonly title: string;
  readonly url: string;
  readonly content: string | null;
  readonly metadata: Prisma.InputJsonValue;
  readonly collectedAt: Date;
  readonly expiresAt: Date;
};

export type BuildRawItemInputsInput = {
  readonly itemType: string;
  readonly query: string;
  readonly collectedAt: Date;
  readonly items: readonly NaverSearchItem[];
};

type NaverRuntime = {
  readonly client: NaverClient;
  readonly config: NaverClientConfig;
};

function expiresFrom(collectedAt: Date): Date {
  return new Date(collectedAt.getTime() + sevenDaysMs);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Naver search failure.";
}

function createNaverRuntime(): NaverRuntime | null {
  const clientId = process.env["NAVER_CLIENT_ID"]?.trim();
  const clientSecret = process.env["NAVER_CLIENT_SECRET"]?.trim();
  if (
    clientId === undefined ||
    clientId === "" ||
    clientSecret === undefined ||
    clientSecret === ""
  ) {
    return null;
  }

  const config = {
    clientId,
    clientSecret,
    blogSearchUrl: process.env["NAVER_BLOG_SEARCH_URL"] ?? defaultBlogSearchUrl,
    shoppingSearchUrl: process.env["NAVER_SHOPPING_SEARCH_URL"] ?? defaultShoppingSearchUrl,
    timeoutMs: 10_000,
  } satisfies NaverClientConfig;
  return { client: new NaverClient(config), config };
}

export function buildRawItemInputs(input: BuildRawItemInputsInput): readonly RawItemInput[] {
  return input.items.map((item) => ({
    itemType: input.itemType,
    title: item.title,
    url: item.link,
    content: item.description ?? null,
    metadata: {
      query: input.query,
      source: "naver_api",
    },
    collectedAt: input.collectedAt,
    expiresAt: expiresFrom(input.collectedAt),
  }));
}

async function getOrCreateSource(sourceType: string, apiEndpoint: string) {
  const source = await prisma.source.findFirst({ where: { sourceType, apiEndpoint } });
  if (source !== null) {
    return prisma.source.update({
      where: { id: source.id },
      data: { lastScannedAt: new Date(), status: "active" },
    });
  }

  return prisma.source.create({
    data: {
      sourceType,
      apiEndpoint,
      lastScannedAt: new Date(),
    },
  });
}

async function persistRawItems(
  sourceType: string,
  apiEndpoint: string,
  inputs: readonly RawItemInput[],
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  const source = await getOrCreateSource(sourceType, apiEndpoint);
  await Promise.all(
    inputs.map((input) =>
      prisma.rawItem.create({
        data: {
          sourceId: source.id,
          itemType: input.itemType,
          title: input.title,
          url: input.url,
          content: input.content,
          metadata: input.metadata,
          collectedAt: input.collectedAt,
          expiresAt: input.expiresAt,
        },
      }),
    ),
  );
}

async function fallbackRawItems(
  query: string,
  collectedAt: Date,
): Promise<readonly RawItemInput[]> {
  const previous = await prisma.rawItem.findMany({
    where: { collectedAt: { gte: new Date(collectedAt.getTime() - sevenDaysMs) } },
    orderBy: { collectedAt: "desc" },
    take: 5,
  });
  if (previous.length > 0) {
    return previous.map((item) => ({
      itemType: item.itemType,
      title: item.title,
      url: item.url,
      content: item.content,
      metadata: {
        query,
        source: "fallback_previous_raw_item",
        raw_item_id: item.id,
      },
      collectedAt,
      expiresAt: expiresFrom(collectedAt),
    }));
  }

  const fallback = [
    {
      itemType: "fallback",
      title: `${query} 최근 스캔 결과 기반`,
      url: `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`,
      content: "Naver API 장애 또는 미설정으로 최근 스캔 결과 기반 보완 입력을 사용합니다.",
      metadata: {
        query,
        source: "fallback_internal",
      },
      collectedAt,
      expiresAt: expiresFrom(collectedAt),
    },
  ] satisfies readonly RawItemInput[];
  await persistRawItems("fallback", "internal:fallback", fallback);
  return fallback;
}

export async function collectHermesRawItems(query: string): Promise<readonly RawItemInput[]> {
  const collectedAt = new Date();
  const runtime = createNaverRuntime();
  if (runtime === null) {
    return fallbackRawItems(query, collectedAt);
  }

  try {
    const [blogItems, shoppingItems] = await Promise.all([
      runtime.client.searchBlog(query),
      runtime.client.searchShopping(query),
    ]);
    const blogRawItems = buildRawItemInputs({
      itemType: "naver_blog",
      query,
      collectedAt,
      items: blogItems,
    });
    const shoppingRawItems = buildRawItemInputs({
      itemType: "naver_shopping",
      query,
      collectedAt,
      items: shoppingItems,
    });
    await Promise.all([
      persistRawItems("naver_blog", runtime.config.blogSearchUrl, blogRawItems),
      persistRawItems("naver_shopping", runtime.config.shoppingSearchUrl, shoppingRawItems),
    ]);
    return [...blogRawItems, ...shoppingRawItems];
  } catch (error) {
    const stackTrace = error instanceof Error ? error.stack : undefined;
    await recordErrorLog({
      errorCode: "NAVER_SEARCH_FAILED",
      message: errorMessage(error),
      severity: "medium",
      context: { query },
      ...(stackTrace === undefined ? {} : { stackTrace }),
    });
    return fallbackRawItems(query, collectedAt);
  }
}
