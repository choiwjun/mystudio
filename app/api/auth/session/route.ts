import { withApiErrorLogging } from "@/lib/api/handler";
import { fail, ok } from "@/lib/api/response";
import { readSessionFromRequest } from "@/lib/auth/session";

export const GET = withApiErrorLogging("auth.session", async (request) => {
  const session = await readSessionFromRequest(request);
  if (session === null) {
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
