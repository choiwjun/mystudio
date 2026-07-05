import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { applyFixesToComplianceCheck } from "@/lib/compliance/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("compliance.checks.apply-fixes", async () => {
    const params = await context.params;
    const draft = await applyFixesToComplianceCheck(params.id);
    if (draft === null) {
      return fail({ code: "NOT_FOUND", message: "Compliance check or draft was not found." }, 404);
    }
    return ok(draft);
  });
  return guarded(request);
}
