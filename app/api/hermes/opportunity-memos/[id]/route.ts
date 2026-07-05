import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getOpportunityMemo } from "@/lib/hermes/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("hermes.opportunity-memos.get", async () => {
    const params = await context.params;
    const memo = await getOpportunityMemo(params.id);
    if (memo === null) {
      return fail({ code: "NOT_FOUND", message: "Opportunity memo was not found." }, 404);
    }
    return ok(memo);
  });
  return guarded(request);
}
