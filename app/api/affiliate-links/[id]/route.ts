import type { NextRequest } from "next/server";
import {
  affiliateLinkPatchSchema,
  deleteAffiliateLink,
  updateAffiliateLink,
} from "@/lib/affiliate/service";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("affiliate-links.patch", async () => {
    const parsed = affiliateLinkPatchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid affiliate link patch payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const link = await updateAffiliateLink(params.id, parsed.data);
    if (link === null) {
      return fail({ code: "NOT_FOUND", message: "Affiliate link was not found." }, 404);
    }
    return ok(link);
  });
  return guarded(request);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("affiliate-links.delete", async () => {
    const params = await context.params;
    const deleted = await deleteAffiliateLink(params.id);
    if (!deleted) {
      return fail({ code: "NOT_FOUND", message: "Affiliate link was not found." }, 404);
    }
    return ok({ deleted: true });
  });
  return guarded(request);
}
