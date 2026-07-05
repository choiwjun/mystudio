import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getComplianceCheck } from "@/lib/compliance/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("compliance.checks.get", async () => {
    const params = await context.params;
    const check = await getComplianceCheck(params.id);
    if (check === null) {
      return fail({ code: "NOT_FOUND", message: "Compliance check was not found." }, 404);
    }
    return ok(check);
  });
  return guarded(request);
}
