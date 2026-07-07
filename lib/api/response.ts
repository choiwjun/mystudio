import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";

export type ApiErrorBody = {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type ApiResponse<T> = {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: ApiErrorBody | null;
  readonly timestamp: string;
  readonly request_id: string;
};

export function createRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

const requestIdStorage = new AsyncLocalStorage<string>();

export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return requestIdStorage.run(requestId, callback);
}

export function getCurrentRequestId(): string | null {
  return requestIdStorage.getStore() ?? null;
}

function resolveResponseRequestId(): string {
  return getCurrentRequestId() ?? createRequestId();
}

export function apiSuccess<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    request_id: requestId,
  };
}

export function apiFailure(error: ApiErrorBody, requestId: string): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error,
    timestamp: new Date().toISOString(),
    request_id: requestId,
  };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json(apiSuccess(data, resolveResponseRequestId()), init);
}

export function fail(error: ApiErrorBody, status: number): NextResponse<ApiResponse<never>> {
  return NextResponse.json(apiFailure(error, resolveResponseRequestId()), { status });
}
