import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  isCompanyProfileSetupRequiredError,
  profileSetupRequiredError,
} from "@/lib/company-profile/service";
import { createPaperclipDecision, decisionCreateSchema } from "@/lib/decisions/service";

export const POST = withAuthenticatedApi("hq.decisions.create", async (request) => {
  const parsed = decisionCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid decision payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  try {
    return ok(await createPaperclipDecision(parsed.data));
  } catch (error) {
    if (isCompanyProfileSetupRequiredError(error)) {
      return fail(profileSetupRequiredError(), 428);
    }
    throw error;
  }
});
