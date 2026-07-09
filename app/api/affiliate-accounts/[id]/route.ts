import type { NextRequest } from "next/server";
import {
  affiliateAccountPatchSchema,
  deleteAffiliateAccount,
  updateAffiliateAccount,
} from "@/lib/affiliate/service";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("affiliate-accounts.patch", async () => {
    const parsed = affiliateAccountPatchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid affiliate account patch payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const account = await updateAffiliateAccount(params.id, parsed.data);
    if (account === null) {
      return fail({ code: "NOT_FOUND", message: "Affiliate account was not found." }, 404);
    }
    return ok(account);
  });
  return guarded(request);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("affiliate-accounts.delete", async () => {
    const params = await context.params;
    const deleted = await deleteAffiliateAccount(params.id);
    if (!deleted) {
      return fail({ code: "NOT_FOUND", message: "Affiliate account was not found." }, 404);
    }
    return ok({ deleted: true });
  });
  return guarded(request);
}
