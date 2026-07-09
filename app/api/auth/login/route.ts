import { withApiErrorLogging } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { readSessionFromRequest } from "@/lib/auth/session";

export const POST = withApiErrorLogging("auth.login", async (request) => {
  const session = await readSessionFromRequest(request);
  return ok({
    user: {
      email: session.email,
      name: session.name,
    },
    csrf_token: session.csrfToken,
    expires_at: session.expiresAt,
  });
});
