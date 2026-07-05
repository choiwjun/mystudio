import { fail } from "@/lib/api/response";

export type CronGuardResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly response: Response };

export function verifyCronSecret(
  headers: Headers,
  expectedSecret: string | undefined,
): CronGuardResult {
  if (!expectedSecret) {
    return {
      allowed: false,
      response: fail(
        {
          code: "CRON_SECRET_NOT_CONFIGURED",
          message: "CRON_SECRET is required before enabling cron endpoints.",
        },
        500,
      ),
    };
  }

  const receivedSecret = headers.get("x-cron-secret");
  if (receivedSecret !== expectedSecret) {
    return {
      allowed: false,
      response: fail(
        {
          code: "UNAUTHORIZED",
          message: "Cron endpoint requires a valid CRON_SECRET header.",
        },
        401,
      ),
    };
  }

  return { allowed: true };
}
