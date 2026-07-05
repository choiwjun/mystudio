import { withApiErrorLogging } from "@/lib/api/handler";
import { fail, ok } from "@/lib/api/response";
import { readSessionFromRequest } from "@/lib/auth/session";
import {
  isCompanyProfileSetupRequiredError,
  profileSetupRequiredError,
} from "@/lib/company-profile/service";
import { scanHermes } from "@/lib/hermes/service";
import { verifyCronSecret } from "@/lib/security/cron";

export const POST = withApiErrorLogging("hermes.scan", async (request) => {
  const cronSecret = request.headers.get("x-cron-secret");
  const session = await readSessionFromRequest(request);

  if (cronSecret !== null) {
    const cronGuard = verifyCronSecret(request.headers, process.env["CRON_SECRET"]);
    if (!cronGuard.allowed) {
      return cronGuard.response;
    }
  } else if (session === null) {
    return fail(
      {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
      401,
    );
  }

  const triggerExecutionId =
    request.headers.get("x-trigger-execution-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID();
  try {
    const result = await scanHermes(triggerExecutionId);
    switch (result.kind) {
      case "blocked_by_budget":
        return fail(result.error, 429);
      case "completed":
        return ok({
          opportunity_memos: result.opportunityMemos,
          budget_blocked_after_partial: result.budgetBlockedAfterPartial,
        });
    }
  } catch (error) {
    if (isCompanyProfileSetupRequiredError(error)) {
      return fail(profileSetupRequiredError(), 428);
    }
    throw error;
  }
});
