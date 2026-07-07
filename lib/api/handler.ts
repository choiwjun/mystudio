import type { NextRequest } from "next/server";
import { createRequestId, fail, runWithRequestId } from "@/lib/api/response";
import { recordErrorLog } from "@/lib/logging/errorLogger";

export type ApiRouteHandler = (request: NextRequest) => Promise<Response> | Response;

export function withApiErrorLogging(routeName: string, handler: ApiRouteHandler): ApiRouteHandler {
  return async (request: NextRequest): Promise<Response> => {
    const requestId = createRequestId();
    return runWithRequestId(requestId, async () => {
      const startedAt = performance.now();
      try {
        const response = await handler(request);
        response.headers.set(
          "x-response-time-ms",
          Math.round(performance.now() - startedAt).toString(),
        );
        response.headers.set("x-request-id", requestId);
        return response;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown API error";
        const stackTrace = error instanceof Error ? error.stack : undefined;
        await recordErrorLog({
          errorCode: "UNHANDLED_API_ERROR",
          message,
          severity: "high",
          ...(stackTrace === undefined ? {} : { stackTrace }),
          context: {
            request_id: requestId,
            routeName,
            apiPath: request.nextUrl.pathname,
            method: request.method,
          },
        });

        const response = fail(
          {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected API error.",
          },
          500,
        );
        response.headers.set(
          "x-response-time-ms",
          Math.round(performance.now() - startedAt).toString(),
        );
        response.headers.set("x-request-id", requestId);
        return response;
      }
    });
  };
}
