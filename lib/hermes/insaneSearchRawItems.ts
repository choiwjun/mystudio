import ky, { HTTPError, TimeoutError } from "ky";
import { prisma } from "@/lib/db";
import { buildInsaneSearchRawItems } from "@/lib/hermes/insaneSearchRawItemMapper";
import type { NaverRawCollectionTarget, RawItemInput } from "@/lib/hermes/rawItems";
import {
  insaneSearchLicense,
  insaneSearchPinnedRef,
  insaneSearchUpstream,
} from "@/lib/products/insaneSearch";

const defaultInsaneSearchTimeoutMs = 5_000;

type HermesInsaneSearchRequest = {
  readonly workerUrl: string;
  readonly query: string;
  readonly target: NaverRawCollectionTarget;
};

type CollectInsaneSearchRawItemsInput = {
  readonly query: string;
  readonly target: NaverRawCollectionTarget;
};

type HermesInsaneSearchRequester = (request: HermesInsaneSearchRequest) => Promise<unknown | null>;

function sourceList(target: NaverRawCollectionTarget): readonly string[] {
  switch (target) {
    case "all":
      return ["naver_blog", "naver_shopping"];
    case "blog":
      return ["naver_blog"];
    case "shopping":
      return ["naver_shopping"];
  }
}

function timeoutMsFromEnv(): number {
  const parsed = Number.parseInt(
    process.env["INSANE_SEARCH_TIMEOUT_MS"] ?? String(defaultInsaneSearchTimeoutMs),
    10,
  );
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultInsaneSearchTimeoutMs;
}

function workerUrlFromEnv(): string | null {
  const workerUrl = process.env["INSANE_SEARCH_WORKER_URL"]?.trim();
  return workerUrl === undefined || workerUrl.length === 0 ? null : workerUrl;
}

async function defaultHermesInsaneSearchRequester(
  request: HermesInsaneSearchRequest,
): Promise<unknown | null> {
  try {
    return await ky
      .post(request.workerUrl, {
        json: {
          mode: "search",
          task: "hermes_search",
          query: request.query,
          target: request.target,
          sources: sourceList(request.target),
          upstream: insaneSearchUpstream,
          pinned_ref: insaneSearchPinnedRef,
          license: insaneSearchLicense,
          disable_auto_install: true,
        },
        headers: {
          "x-insane-search-upstream": insaneSearchUpstream,
          "x-insane-search-pinned-ref": insaneSearchPinnedRef,
          "x-insane-search-license": insaneSearchLicense,
        },
        timeout: timeoutMsFromEnv(),
        retry: { limit: 0 },
      })
      .json<unknown>();
  } catch (error) {
    if (
      error instanceof HTTPError ||
      error instanceof TimeoutError ||
      error instanceof TypeError ||
      error instanceof SyntaxError
    ) {
      return null;
    }
    throw error;
  }
}

let hermesInsaneSearchRequester = defaultHermesInsaneSearchRequester;

export function setHermesInsaneSearchRequesterForTest(
  requester: HermesInsaneSearchRequester,
): void {
  hermesInsaneSearchRequester = requester;
}

export function resetHermesInsaneSearchRequesterForTest(): void {
  hermesInsaneSearchRequester = defaultHermesInsaneSearchRequester;
}

async function persistInsaneSearchRawItems(
  workerUrl: string,
  inputs: readonly RawItemInput[],
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  const source =
    (await prisma.source.findFirst({
      where: { sourceType: "insane_search", apiEndpoint: workerUrl },
    })) ??
    (await prisma.source.create({
      data: { sourceType: "insane_search", apiEndpoint: workerUrl, lastScannedAt: new Date() },
    }));

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

export async function collectInsaneSearchRawItems(
  input: CollectInsaneSearchRawItemsInput,
): Promise<readonly RawItemInput[] | null> {
  const workerUrl = workerUrlFromEnv();
  if (workerUrl === null) {
    return null;
  }

  const response = await hermesInsaneSearchRequester({
    workerUrl,
    query: input.query,
    target: input.target,
  });
  if (response === null) {
    return null;
  }

  const rawItems = buildInsaneSearchRawItems({
    query: input.query,
    target: input.target,
    response,
    collectedAt: new Date(),
  });
  if (rawItems.length === 0) {
    return null;
  }

  await persistInsaneSearchRawItems(workerUrl, rawItems);
  return rawItems;
}
