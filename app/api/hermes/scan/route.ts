import { withApiErrorLogging } from "@/lib/api/handler";
import { fail, ok } from "@/lib/api/response";
import { readSessionFromRequest } from "@/lib/auth/session";
import {
  isCompanyProfileSetupRequiredError,
  profileSetupRequiredError,
} from "@/lib/company-profile/service";
import { scanHermes } from "@/lib/hermes/service";
import { hasCronCredentialAttempt, verifyCronSecret } from "@/lib/security/cron";

function missingStableExecutionIdResponse(): Response {
  return fail(
    {
      code: "STABLE_TRIGGER_EXECUTION_ID_REQUIRED",
      message: "Cron-triggered Hermes scans require x-trigger-execution-id.",
    },
    428,
  );
}

function stableTriggerExecutionId(request: Request, mode: "cron" | "session"): string | null {
  const headerValue = request.headers.get("x-trigger-execution-id")?.trim();
  if (headerValue !== undefined && headerValue !== "") {
    return headerValue;
  }
  return mode === "session" ? crypto.randomUUID() : null;
}
async function handleHermesScan(
  request: Request,
  authMode: "cron" | "session-or-cron",
): Promise<Response> {
  const isCronPath = authMode === "cron" || hasCronCredentialAttempt(request.headers);
  if (isCronPath) {
    const cronGuard = verifyCronSecret(request.headers, process.env["CRON_SECRET"]);
    if (!cronGuard.allowed) {
      return cronGuard.response;
    }
  } else {
    const session = await readSessionFromRequest(request);
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.method !== "OPTIONS" &&
      request.headers.get("x-csrf-token") !== session.csrfToken
    ) {
      return fail(
        {
          code: "CSRF_TOKEN_INVALID",
          message: "A valid CSRF token is required.",
        },
        403,
      );
    }
  }

  const triggerExecutionId = stableTriggerExecutionId(request, isCronPath ? "cron" : "session");
  if (triggerExecutionId === null) {
    return missingStableExecutionIdResponse();
  }

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
}

export const GET = withApiErrorLogging("hermes.scan", async (request) =>
  handleHermesScan(request, "cron"),
);

export const POST = withApiErrorLogging("hermes.scan", async (request) =>
  handleHermesScan(request, "session-or-cron"),
);
