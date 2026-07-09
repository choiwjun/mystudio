import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { NaverRawCollectionTarget, RawItemInput } from "@/lib/hermes/rawItems";
import { insaneSearchPinnedRef, insaneSearchUpstream } from "@/lib/products/insaneSearch";

const workerSearchItemSchema = z
  .object({
    title: z.string().optional(),
    link: z.string().optional(),
    url: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    source: z.string().optional(),
    item_type: z.string().optional(),
  })
  .passthrough();

const workerSearchResponseSchema = z
  .object({
    items: z.array(workerSearchItemSchema).optional(),
    results: z.array(workerSearchItemSchema).optional(),
    blog_items: z.array(workerSearchItemSchema).optional(),
    shopping_items: z.array(workerSearchItemSchema).optional(),
    trace_id: z.string().optional(),
    failure_reason: z.string().optional(),
  })
  .passthrough();

type WorkerSearchResponse = z.infer<typeof workerSearchResponseSchema>;
type WorkerSearchItem = z.infer<typeof workerSearchItemSchema>;

type BuildInsaneSearchRawItemsInput = {
  readonly query: string;
  readonly target: NaverRawCollectionTarget;
  readonly response: unknown;
  readonly collectedAt: Date;
};

type WorkerItemWithFallback = {
  readonly item: WorkerSearchItem;
  readonly fallbackType: string;
};

function fallbackItemType(target: NaverRawCollectionTarget): string {
  switch (target) {
    case "all":
      return "insane_search";
    case "blog":
      return "naver_blog";
    case "shopping":
      return "naver_shopping";
  }
}

function cleanText(value: string | undefined, maxLength: number): string | null {
  if (value === undefined) {
    return null;
  }
  const cleaned = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) {
    return null;
  }
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

function cleanUrl(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

function inferItemType(item: WorkerSearchItem, fallback: string): string {
  const candidate = `${item.item_type ?? ""} ${item.source ?? ""}`.toLowerCase();
  if (candidate.includes("shopping") || candidate.includes("shop")) {
    return "naver_shopping";
  }
  if (candidate.includes("blog")) {
    return "naver_blog";
  }
  return fallback;
}

function targetAcceptsItemType(target: NaverRawCollectionTarget, itemType: string): boolean {
  switch (target) {
    case "all":
      return true;
    case "blog":
      return itemType === "naver_blog";
    case "shopping":
      return itemType === "naver_shopping";
  }
}

function withFallbackType(
  items: readonly WorkerSearchItem[],
  fallbackType: string,
): readonly WorkerItemWithFallback[] {
  return items.map((item) => ({ item, fallbackType }));
}

function responseItems(
  response: WorkerSearchResponse,
  target: NaverRawCollectionTarget,
): readonly WorkerItemWithFallback[] {
  const genericFallback = fallbackItemType(target);
  return [
    ...withFallbackType(response.items ?? [], genericFallback),
    ...withFallbackType(response.results ?? [], genericFallback),
    ...(target === "shopping" ? [] : withFallbackType(response.blog_items ?? [], "naver_blog")),
    ...(target === "blog" ? [] : withFallbackType(response.shopping_items ?? [], "naver_shopping")),
  ];
}

function metadataForItem(input: {
  readonly query: string;
  readonly target: NaverRawCollectionTarget;
  readonly itemType: string;
  readonly traceId: string | undefined;
}): Prisma.InputJsonObject {
  return {
    query: input.query,
    source: "insane_search",
    target: input.target,
    itemType: input.itemType,
    upstream: insaneSearchUpstream,
    pinned_ref: insaneSearchPinnedRef,
    ...(input.traceId === undefined ? {} : { trace_id: input.traceId }),
  };
}

function rawItemFromWorkerItem(input: {
  readonly item: WorkerSearchItem;
  readonly query: string;
  readonly target: NaverRawCollectionTarget;
  readonly fallbackType: string;
  readonly collectedAt: Date;
  readonly traceId: string | undefined;
}): RawItemInput | null {
  const itemType = inferItemType(input.item, input.fallbackType);
  if (!targetAcceptsItemType(input.target, itemType)) {
    return null;
  }

  const title = cleanText(input.item.title, 200);
  const url = cleanUrl(input.item.link ?? input.item.url);
  if (title === null || url === null) {
    return null;
  }

  return {
    itemType,
    title,
    url,
    content: cleanText(input.item.description ?? input.item.content, 1_000),
    metadata: metadataForItem({
      query: input.query,
      target: input.target,
      itemType,
      traceId: input.traceId,
    }),
    collectedAt: input.collectedAt,
    expiresAt: new Date(input.collectedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

export function buildInsaneSearchRawItems(
  input: BuildInsaneSearchRawItemsInput,
): readonly RawItemInput[] {
  const parsed = workerSearchResponseSchema.safeParse(input.response);
  if (!parsed.success || parsed.data.failure_reason !== undefined) {
    return [];
  }

  return responseItems(parsed.data, input.target)
    .map((entry) =>
      rawItemFromWorkerItem({
        item: entry.item,
        query: input.query,
        target: input.target,
        fallbackType: entry.fallbackType,
        collectedAt: input.collectedAt,
        traceId: parsed.data.trace_id,
      }),
    )
    .filter((item) => item !== null);
}
