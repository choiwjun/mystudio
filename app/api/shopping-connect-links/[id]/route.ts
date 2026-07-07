import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  deleteShoppingConnectLink,
  shoppingConnectLinkPatchSchema,
  updateShoppingConnectLink,
} from "@/lib/products/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("shopping-connect-links.patch", async () => {
    const parsed = shoppingConnectLinkPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid shopping connect link patch payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const link = await updateShoppingConnectLink(params.id, parsed.data);
    if (link === null) {
      return fail({ code: "NOT_FOUND", message: "Shopping connect link was not found." }, 404);
    }
    return ok(link);
  });
  return guarded(request);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("shopping-connect-links.delete", async () => {
    const params = await context.params;
    const deleted = await deleteShoppingConnectLink(params.id);
    if (!deleted) {
      return fail({ code: "NOT_FOUND", message: "Shopping connect link was not found." }, 404);
    }
    return ok({ deleted: true });
  });
  return guarded(request);
}
