import type { Prisma } from "@prisma/client";
import { getActiveApiCredentialSecret } from "@/lib/api-credentials/service";
import { canUseMissingDatabaseFallback, prisma } from "@/lib/db";
import { recordErrorLog } from "@/lib/logging/errorLogger";
import {
  NaverApiRequestError,
  NaverClient,
  type NaverClientConfig,
  type NaverSearchItem,
} from "@/lib/naver/client";

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

export type NaverRawCollectionTarget = "all" | "blog" | "shopping";

type NaverCredentialPair = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export class NaverCredentialsMissingError extends Error {
  readonly code = "NAVER_CREDENTIALS_MISSING";

  constructor() {
    super("Naver credentials are required to collect Hermes raw items.");
    this.name = "NaverCredentialsMissingError";
  }
}

export type NaverCollectionFailureCode =
  | "NAVER_CREDENTIALS_MISSING"
  | "NAVER_SEARCH_TIMEOUT"
  | "NAVER_SEARCH_RATE_LIMITED"
  | "NAVER_SEARCH_FAILED";

export class NaverCollectionFailedError extends Error {
  readonly code: NaverCollectionFailureCode;
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(`Naver raw item collection failed: ${errorMessage(cause)}`);
    this.name = "NaverCollectionFailedError";
    this.code = errorCode(cause);
    this.cause = cause;
  }
}

function expiresFrom(collectedAt: Date): Date {
  return new Date(collectedAt.getTime() + sevenDaysMs);
}

function errorCode(error: unknown): NaverCollectionFailureCode {
  if (error instanceof NaverCredentialsMissingError) {
    return "NAVER_CREDENTIALS_MISSING";
  }
  if (isRateLimitError(error)) {
    return "NAVER_SEARCH_RATE_LIMITED";
  }
  if (isTimeoutError(error)) {
    return "NAVER_SEARCH_TIMEOUT";
  }
  return "NAVER_SEARCH_FAILED";
}

function errorStatus(error: unknown): number | null {
  const candidate = error instanceof NaverApiRequestError ? error.cause : error;
  if (typeof candidate !== "object" || candidate === null || !("response" in candidate)) {
    return null;
  }
  const response = (candidate as { readonly response?: { readonly status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : null;
}

function nestedCause(error: unknown): unknown {
  if (error instanceof NaverApiRequestError) {
    return error.cause;
  }
  if (typeof error === "object" && error !== null && "cause" in error) {
    return (error as { readonly cause?: unknown }).cause;
  }
  return undefined;
}

function isRateLimitError(error: unknown): boolean {
  if (errorStatus(error) === 429) {
    return true;
  }
  const cause = nestedCause(error);
  return cause === undefined ? false : isRateLimitError(cause);
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name.toLowerCase().includes("timeout")) {
    return true;
  }
  const cause = nestedCause(error);
  return cause === undefined ? false : isTimeoutError(cause);
}

function fallbackContextMetadata(
  query: string,
  code: NaverCollectionFailureCode,
  message: string,
  source: "recent_raw_item" | "recent_opportunity_memo" | "fallback_context",
): Prisma.InputJsonObject {
  return {
    query,
    source,
    fallback: true,
    fallback_reason_code: code,
    fallback_reason: message,
  };
}

async function loadFallbackRawItems(
  query: string,
  code: NaverCollectionFailureCode,
  message: string,
  collectedAt: Date,
): Promise<readonly RawItemInput[]> {
  const recentRawItems = await prisma.rawItem.findMany({
    orderBy: { collectedAt: "desc" },
    take: 8,
  });
  const recentMemoItems = await prisma.opportunityMemo.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const rawFallbacks = recentRawItems.map((item) => ({
    itemType: `fallback_${item.itemType}`,
    title: item.title,
    url: item.url,
    content: item.content,
    metadata: {
      ...fallbackContextMetadata(query, code, message, "recent_raw_item"),
      original_item_type: item.itemType,
      original_collected_at: item.collectedAt.toISOString(),
    },
    collectedAt,
    expiresAt: expiresFrom(collectedAt),
  }));

  const memoFallbacks = recentMemoItems.map((memo) => ({
    itemType: "fallback_opportunity_memo",
    title: memo.topic,
    url: `paperclip://opportunity-memos/${memo.id}`,
    content: [memo.whyNow, memo.homefeedAngle, memo.searchAngle].join("\n"),
    metadata: {
      ...fallbackContextMetadata(query, code, message, "recent_opportunity_memo"),
      original_memo_id: memo.id,
      original_created_at: memo.createdAt.toISOString(),
    },
    collectedAt,
    expiresAt: expiresFrom(collectedAt),
  }));

  const fallbackItems = [...rawFallbacks, ...memoFallbacks];
  if (fallbackItems.length > 0) {
    return fallbackItems;
  }

  return [
    {
      itemType: "fallback_context",
      title: "Naver 수집 실패 fallback context",
      url: "paperclip://hermes/naver-fallback",
      content: `Naver 수집이 실패해 최근 raw/memo 데이터가 없는 상태에서 회사 프로필과 메모리 컨텍스트만 사용합니다. 원인: ${message}`,
      metadata: fallbackContextMetadata(query, code, message, "fallback_context"),
      collectedAt,
      expiresAt: expiresFrom(collectedAt),
    },
  ];
}

async function recordNaverCollectionError(
  query: string,
  code: NaverCollectionFailureCode,
  error: unknown,
): Promise<void> {
  const stackTrace = error instanceof Error ? error.stack : undefined;
  await recordErrorLog({
    errorCode: code,
    message: errorMessage(error),
    severity: "medium",
    context: { query, fallback: "recent_raw_or_memo" },
    ...(stackTrace === undefined ? {} : { stackTrace }),
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Naver search failure.";
}

function parseNaverCredentialSecret(secret: string): NaverCredentialPair | null {
  const trimmed = secret.trim();
  if (trimmed === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const record = parsed as {
        readonly clientId?: unknown;
        readonly clientSecret?: unknown;
        readonly client_id?: unknown;
        readonly client_secret?: unknown;
      };
      const clientId = record.clientId ?? record.client_id;
      const clientSecret = record.clientSecret ?? record.client_secret;
      if (
        typeof clientId === "string" &&
        clientId.trim() !== "" &&
        typeof clientSecret === "string" &&
        clientSecret.trim() !== ""
      ) {
        return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
      }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
  }

  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null;
  }
  const clientId = trimmed.slice(0, separatorIndex).trim();
  const clientSecret = trimmed.slice(separatorIndex + 1).trim();
  return clientId === "" || clientSecret === "" ? null : { clientId, clientSecret };
}

async function resolveStoredNaverCredentials(): Promise<NaverCredentialPair | null> {
  try {
    const storedSecret = await getActiveApiCredentialSecret("naver");
    return storedSecret === null ? null : parseNaverCredentialSecret(storedSecret);
  } catch (error) {
    if (canUseMissingDatabaseFallback(error)) {
      return null;
    }
    throw error;
  }
}

async function resolveNaverCredentials(): Promise<NaverCredentialPair | null> {
  const clientId = process.env["NAVER_CLIENT_ID"]?.trim();
  const clientSecret = process.env["NAVER_CLIENT_SECRET"]?.trim();
  if (
    clientId !== undefined &&
    clientId !== "" &&
    clientSecret !== undefined &&
    clientSecret !== ""
  ) {
    return { clientId, clientSecret };
  }
  return resolveStoredNaverCredentials();
}

async function createNaverRuntime(): Promise<NaverRuntime> {
  const credentials = await resolveNaverCredentials();
  if (credentials === null) {
    throw new NaverCredentialsMissingError();
  }

  const config = {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
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
      itemType: input.itemType,
    },
    collectedAt: input.collectedAt,
    expiresAt: expiresFrom(input.collectedAt),
  }));
}

export function serializeRawItemInput(input: RawItemInput) {
  return {
    item_type: input.itemType,
    title: input.title,
    url: input.url,
    content: input.content,
    metadata: input.metadata,
    collected_at: input.collectedAt.toISOString(),
    expires_at: input.expiresAt.toISOString(),
  };
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

export async function collectNaverRawItems(
  query: string,
  target: NaverRawCollectionTarget,
): Promise<readonly RawItemInput[]> {
  const collectedAt = new Date();

  try {
    const runtime = await createNaverRuntime();
    const [blogItems, shoppingItems] = await Promise.all([
      target === "shopping" ? Promise.resolve([]) : runtime.client.searchBlog(query),
      target === "blog" ? Promise.resolve([]) : runtime.client.searchShopping(query),
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
    const persistJobs: Promise<void>[] = [];
    if (blogRawItems.length > 0) {
      persistJobs.push(persistRawItems("naver_blog", runtime.config.blogSearchUrl, blogRawItems));
    }
    if (shoppingRawItems.length > 0) {
      persistJobs.push(
        persistRawItems("naver_shopping", runtime.config.shoppingSearchUrl, shoppingRawItems),
      );
    }
    await Promise.all(persistJobs);
    return [...blogRawItems, ...shoppingRawItems];
  } catch (error) {
    if (error instanceof NaverCredentialsMissingError) {
      throw error;
    }
    const code = errorCode(error);
    const message = errorMessage(error);
    await recordNaverCollectionError(query, code, error);
    return loadFallbackRawItems(query, code, message, collectedAt);
  }
}

export async function collectHermesRawItems(query: string): Promise<readonly RawItemInput[]> {
  return collectNaverRawItems(query, "all");
}
