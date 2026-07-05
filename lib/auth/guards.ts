import type { NextRequest } from "next/server";
import { withApiErrorLogging } from "@/lib/api/handler";
import { fail } from "@/lib/api/response";
import { type OwnerSession, readSessionFromRequest } from "@/lib/auth/session";
import { recordErrorLog } from "@/lib/logging/errorLogger";

type AuthenticatedHandler = (
  request: NextRequest,
  session: OwnerSession,
) => Promise<Response> | Response;

async function safeRecordAuthError(
  request: NextRequest,
  code: string,
  message: string,
): Promise<void> {
  try {
    await recordErrorLog({
      errorCode: code,
      message,
      severity: "medium",
      context: {
        apiPath: request.nextUrl.pathname,
        method: request.method,
      },
    });
  } catch {}
}

function hasValidCsrf(request: NextRequest, session: OwnerSession): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return true;
  }
  return request.headers.get("x-csrf-token") === session.csrfToken;
}

export function withAuthenticatedApi(routeName: string, handler: AuthenticatedHandler) {
  return withApiErrorLogging(routeName, async (request: NextRequest) => {
    const session = await readSessionFromRequest(request);
    if (session === null) {
      await safeRecordAuthError(
        request,
        "UNAUTHORIZED",
        "API request was rejected without a valid session.",
      );
      return fail(
        {
          code: "UNAUTHORIZED",
          message: "Authentication is required.",
        },
        401,
      );
    }

    if (!hasValidCsrf(request, session)) {
      await safeRecordAuthError(
        request,
        "CSRF_TOKEN_INVALID",
        "State-changing API request missed CSRF validation.",
      );
      return fail(
        {
          code: "CSRF_TOKEN_INVALID",
          message: "A valid CSRF token is required.",
        },
        403,
      );
    }

    return handler(request, session);
  });
}
