import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  isCompanyProfileSetupRequiredError,
  profileSetupRequiredError,
} from "@/lib/company-profile/service";
import { createDailyBriefing, dailyBriefingSchema } from "@/lib/hq/service";

export const POST = withAuthenticatedApi("hq.daily-briefing", async (request) => {
  const parsed = dailyBriefingSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "Invalid daily briefing payload." }, 400);
  }
  try {
    return ok(await createDailyBriefing(parsed.data), { status: 201 });
  } catch (error) {
    if (isCompanyProfileSetupRequiredError(error)) {
      return fail(profileSetupRequiredError(), 428);
    }
    throw error;
  }
});
