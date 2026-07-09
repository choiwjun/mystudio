import type { NextRequest } from "next/server";
import { getAffiliateAccountContentPlan } from "@/lib/affiliate/accountContentPlanService";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("affiliate-accounts.content-plan", async () => {
    const params = await context.params;
    const plan = await getAffiliateAccountContentPlan(params.id);
    if (plan === null) {
      return fail({ code: "NOT_FOUND", message: "Affiliate account was not found." }, 404);
    }
    return ok({ content_plan: plan });
  });
  return guarded(request);
}
