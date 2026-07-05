import { z } from "zod";
import { withApiErrorLogging } from "@/lib/api/handler";
import { fail, ok } from "@/lib/api/response";
import { validateOwnerCredentials } from "@/lib/auth/owner";
import { getLoginLock, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/rateLimit";
import { createOwnerSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { recordErrorLog } from "@/lib/logging/errorLogger";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function loginKey(request: Request, email: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${email.toLowerCase()}::${forwardedFor}`;
}

async function safeRecordLoginFailure(email: string, reason: string): Promise<void> {
  try {
    await recordErrorLog({
      errorCode: "LOGIN_FAILED",
      message: "Owner login failed.",
      severity: "medium",
      context: { email, reason },
    });
  } catch {}
}

export const POST = withApiErrorLogging("auth.login", async (request) => {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      {
        code: "BAD_REQUEST",
        message: "Email and password are required.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const key = loginKey(request, parsed.data.email);
  const lock = getLoginLock(key);
  if (lock.locked) {
    return fail(
      {
        code: "LOGIN_RATE_LIMITED",
        message: "Too many failed login attempts. Try again shortly.",
        details: { retry_after_seconds: lock.retryAfterSeconds },
      },
      429,
    );
  }

  const result = await validateOwnerCredentials(parsed.data);
  if (!result.ok) {
    recordLoginFailure(key);
    await safeRecordLoginFailure(parsed.data.email, result.reason);
    return fail(
      {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
      401,
    );
  }

  recordLoginSuccess(key);
  const { token, session, maxAgeSeconds } = await createOwnerSession(result.email);
  const response = ok({
    token,
    user: {
      email: session.email,
      name: session.name,
    },
    csrf_token: session.csrfToken,
    expires_at: session.expiresAt,
  });
  response.cookies.set(sessionCookieName, token, sessionCookieOptions(maxAgeSeconds));
  return response;
});
