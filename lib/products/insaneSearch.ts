import { validateProductImportUrl } from "@/lib/security/productImport";

export const insaneSearchUpstream = "https://github.com/fivetaku/insane-search";
export const insaneSearchPinnedRef = "2714e72282b915c6983723652d0c365af08e9e1f";
export const insaneSearchLicense = "MIT";
const insaneSearchMaxResponseBytes = 32_768;

export type InsaneSearchFailureReason =
  | "blocked_domain"
  | "private_ip"
  | "redirect_blocked"
  | "final_url_uninspectable"
  | "auth_required"
  | "timeout"
  | "crawler_unavailable"
  | "metadata_missing"
  | "invalid_response";

export type InsaneSearchProductInput = {
  readonly product_name: string;
  readonly product_url: string;
  readonly source: "naver_shopping";
  readonly price?: number;
  readonly image_url?: string;
  readonly category?: string;
  readonly memo: string;
};

export type InsaneSearchImportResult =
  | {
      readonly ok: true;
      readonly product: InsaneSearchProductInput;
      readonly trace_id?: string;
    }
  | {
      readonly ok: false;
      readonly reason: InsaneSearchFailureReason;
      readonly trace_id?: string;
    };

type WorkerMetadata = {
  readonly product_name?: unknown;
  readonly price?: unknown;
  readonly image_url?: unknown;
  readonly category?: unknown;
};

export type InsaneSearchWorkerResponse = {
  readonly metadata?: unknown;
  readonly final_url?: unknown;
  readonly redirect_chain?: unknown;
  readonly trace_id?: unknown;
  readonly failure_reason?: unknown;
};

const workerFailureReasons = new Set<InsaneSearchFailureReason>([
  "blocked_domain",
  "private_ip",
  "redirect_blocked",
  "final_url_uninspectable",
  "auth_required",
  "timeout",
  "crawler_unavailable",
  "metadata_missing",
  "invalid_response",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const cleaned = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) {
    return undefined;
  }
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

function cleanPrice(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function cleanImageUrl(value: unknown): string | undefined {
  const cleaned = cleanText(value, 2048);
  if (cleaned === undefined) {
    return undefined;
  }
  try {
    const parsed = new URL(cleaned);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeFailureReason(value: unknown): InsaneSearchFailureReason {
  return typeof value === "string" && workerFailureReasons.has(value as InsaneSearchFailureReason)
    ? (value as InsaneSearchFailureReason)
    : "invalid_response";
}

function normalizeTraceId(value: unknown): string | undefined {
  return cleanText(value, 120);
}

function buildWorkerRequestBody(url: URL): Record<string, unknown> {
  return {
    url: url.toString(),
    upstream: insaneSearchUpstream,
    pinned_ref: insaneSearchPinnedRef,
    license: insaneSearchLicense,
    disable_auto_install: true,
  };
}
async function readBoundedWorkerResponseText(response: Response): Promise<string | null> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number.parseInt(declaredLength, 10);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > insaneSearchMaxResponseBytes) {
      return null;
    }
  }

  if (response.body === null) {
    const body = await response.text();
    return Buffer.byteLength(body, "utf8") > insaneSearchMaxResponseBytes ? null : body;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value === undefined) {
        continue;
      }
      receivedBytes += value.byteLength;
      if (receivedBytes > insaneSearchMaxResponseBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function defaultRunInsaneSearchWorker(url: URL): Promise<InsaneSearchWorkerResponse | null> {
  const workerUrl = process.env["INSANE_SEARCH_WORKER_URL"]?.trim();
  if (workerUrl === undefined || workerUrl.length === 0) {
    return null;
  }

  const timeoutMs = Number.parseInt(process.env["INSANE_SEARCH_TIMEOUT_MS"] ?? "5000", 10);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
  );

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-insane-search-upstream": insaneSearchUpstream,
        "x-insane-search-pinned-ref": insaneSearchPinnedRef,
        "x-insane-search-license": insaneSearchLicense,
      },
      body: JSON.stringify(buildWorkerRequestBody(url)),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { failure_reason: response.status === 408 ? "timeout" : "crawler_unavailable" };
    }
    const body = await readBoundedWorkerResponseText(response);
    if (body === null) {
      return { failure_reason: "invalid_response" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      return { failure_reason: "invalid_response" };
    }
    return isRecord(parsed)
      ? (parsed as InsaneSearchWorkerResponse)
      : { failure_reason: "invalid_response" };
  } catch (error) {
    return {
      failure_reason:
        error instanceof DOMException && error.name === "AbortError"
          ? "timeout"
          : "crawler_unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export let runInsaneSearchWorker = defaultRunInsaneSearchWorker;

export function setInsaneSearchWorkerForTest(
  worker: (url: URL) => Promise<InsaneSearchWorkerResponse | null>,
): void {
  runInsaneSearchWorker = worker;
}

export function resetInsaneSearchWorkerForTest(): void {
  runInsaneSearchWorker = defaultRunInsaneSearchWorker;
}

async function validateEffectiveUrl(
  value: unknown,
): Promise<{ ok: true; url: URL } | { ok: false; reason: InsaneSearchFailureReason }> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: "final_url_uninspectable" };
  }
  const validated = await validateProductImportUrl(value);
  if (!validated.ok) {
    return {
      ok: false,
      reason: validated.reason === "invalid_url" ? "final_url_uninspectable" : validated.reason,
    };
  }
  return { ok: true, url: validated.url };
}

async function validateRedirectChain(value: unknown): Promise<InsaneSearchFailureReason | null> {
  if (value === undefined) {
    return "invalid_response";
  }
  if (!Array.isArray(value) || value.some((hop) => typeof hop !== "string")) {
    return "invalid_response";
  }
  for (const hop of value) {
    const validatedHop = await validateProductImportUrl(hop);
    if (!validatedHop.ok) {
      return validatedHop.reason === "private_ip" ? "private_ip" : "redirect_blocked";
    }
  }
  return null;
}

function withTrace<T extends InsaneSearchImportResult>(result: T, traceId: string | undefined): T {
  return traceId === undefined ? result : ({ ...result, trace_id: traceId } as T);
}

function metadataToProduct(
  metadata: WorkerMetadata,
  finalUrl: URL,
): InsaneSearchProductInput | null {
  const productName = cleanText(metadata.product_name, 160);
  if (productName === undefined) {
    return null;
  }

  const price = cleanPrice(metadata.price);
  const imageUrl = cleanImageUrl(metadata.image_url);
  const category = cleanText(metadata.category, 80);

  const candidate: InsaneSearchProductInput = {
    product_name: productName,
    product_url: finalUrl.toString(),
    source: "naver_shopping",
    ...(price === undefined ? {} : { price }),
    ...(imageUrl === undefined ? {} : { image_url: imageUrl }),
    ...(category === undefined ? {} : { category }),
    memo: `Naver Shopping URL import from ${finalUrl.hostname}. Price needs confirmation before publishing.`,
  };

  return candidate;
}

export async function importProductWithInsaneSearch(url: URL): Promise<InsaneSearchImportResult> {
  const response = await runInsaneSearchWorker(url);
  if (response === null) {
    return { ok: false, reason: "crawler_unavailable" };
  }

  if (!isRecord(response)) {
    return { ok: false, reason: "invalid_response" };
  }

  const traceId = normalizeTraceId(response.trace_id);
  if (response.failure_reason !== undefined) {
    return withTrace(
      { ok: false, reason: normalizeFailureReason(response.failure_reason) },
      traceId,
    );
  }

  const redirectFailure = await validateRedirectChain(response.redirect_chain);
  if (redirectFailure !== null) {
    return withTrace({ ok: false, reason: redirectFailure }, traceId);
  }

  const finalUrl = await validateEffectiveUrl(response.final_url);
  if (!finalUrl.ok) {
    return withTrace({ ok: false, reason: finalUrl.reason }, traceId);
  }

  if (!isRecord(response.metadata)) {
    return withTrace({ ok: false, reason: "metadata_missing" }, traceId);
  }

  const product = metadataToProduct(response.metadata, finalUrl.url);
  if (product === null) {
    return withTrace({ ok: false, reason: "metadata_missing" }, traceId);
  }

  return withTrace({ ok: true, product }, traceId);
}
