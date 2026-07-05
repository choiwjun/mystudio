import { withApiErrorLogging } from "@/lib/api/handler";
import { fail, ok } from "@/lib/api/response";
import { readSessionFromRequest } from "@/lib/auth/session";
import { recordErrorLog } from "@/lib/logging/errorLogger";

async function safeRecordSessionFailure(request: Request): Promise<void> {
  try {
    await recordErrorLog({
      errorCode: "SESSION_UNAUTHORIZED",
      message: "Session endpoint was requested without a valid session.",
      severity: "medium",
      context: {
        method: request.method,
      },
    });
  } catch {}
}

export const GET = withApiErrorLogging("auth.session", async (request) => {
  const session = await readSessionFromRequest(request);
  if (session === null) {
    await safeRecordSessionFailure(request);
    return fail(
      {
        code: "UNAUTHORIZED",
        message: "Session is missing or expired.",
      },
      401,
    );
  }

  return ok({
    user: {
      email: session.email,
      name: session.name,
    },
    csrf_token: session.csrfToken,
    expires_at: session.expiresAt,
  });
});
