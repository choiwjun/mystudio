import { PackageStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { setDecisionPackageStatus } from "@/lib/decisions/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("hq.decisions.approve", async () => {
    const params = await context.params;
    const result = await setDecisionPackageStatus(params.id, PackageStatus.approved);
    if (result === null) {
      return fail({ code: "NOT_FOUND", message: "Decision was not found." }, 404);
    }
    return ok(result);
  });
  return guarded(request);
}
