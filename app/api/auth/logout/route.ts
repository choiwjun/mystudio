import { withApiErrorLogging } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

export const POST = withApiErrorLogging("auth.logout", async () => {
  const response = ok({ logged_out: true });
  response.cookies.set(sessionCookieName, "", sessionCookieOptions(0));
  return response;
});
